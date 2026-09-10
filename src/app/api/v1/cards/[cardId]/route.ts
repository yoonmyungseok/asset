import type { NextRequest } from "next/server";

import { CARD_INCLUDE, serializeCard } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { validateCheckingAccount } from "@/lib/services/card-payments";
import { cardUpdateSchema } from "@/lib/validations/card";

type RouteContext = { params: Promise<{ cardId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { cardId: cardIdRaw } = await context.params;
    const cardId = Number.parseInt(cardIdRaw, 10);
    const payload = parseJsonBody(cardUpdateSchema, await request.json());

    const card = await prisma.$transaction(async (tx) => {
      const existing = await tx.card.findUnique({
        where: { id: cardId },
        include: CARD_INCLUDE,
      });
      if (!existing) {
        throw new ServiceError(404, "카드를 찾을 수 없습니다.");
      }

      if (payload.linked_account_id != null) {
        await validateCheckingAccount(tx, payload.linked_account_id);
      }
      if (payload.settlement_account_id != null) {
        await validateCheckingAccount(tx, payload.settlement_account_id);
      }

      const updated = await tx.card.update({
        where: { id: cardId },
        data: payload,
        include: CARD_INCLUDE,
      });

      if (updated.card_type === "credit" && updated.linked_liability_id) {
        await tx.liability.update({
          where: { id: updated.linked_liability_id },
          data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.institution !== undefined ? { institution: payload.institution } : {}),
            ...(payload.due_day !== undefined ? { due_day: payload.due_day } : {}),
          },
        });
      }

      return tx.card.findUniqueOrThrow({
        where: { id: cardId },
        include: CARD_INCLUDE,
      });
    });

    return jsonOk(serializeCard(card));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { cardId: cardIdRaw } = await context.params;
    const cardId = Number.parseInt(cardIdRaw, 10);

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return handleRouteError(new ServiceError(404, "카드를 찾을 수 없습니다."));
    }

    await prisma.$transaction(async (tx) => {
      await tx.card.update({
        where: { id: cardId },
        data: { is_active: false },
      });
      if (card.linked_liability_id) {
        await tx.liability.update({
          where: { id: card.linked_liability_id },
          data: { is_active: false },
        });
      }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
