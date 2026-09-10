import type { NextRequest } from "next/server";

import {
  CARD_INCLUDE,
  serializeCard,
} from "@/lib/api/serializers";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryBool,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { validateCheckingAccount } from "@/lib/services/card-payments";
import { cardCreateSchema } from "@/lib/validations/card";

export async function GET(request: NextRequest) {
  try {
    const isActiveParam = parseQueryBool(request.nextUrl.searchParams.get("is_active"));
    const isActive = isActiveParam === undefined ? true : isActiveParam;

    const cards = await prisma.card.findMany({
      where: isActive == null ? undefined : { is_active: isActive },
      include: CARD_INCLUDE,
      orderBy: { id: "asc" },
    });

    return jsonOk(cards.map(serializeCard));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(cardCreateSchema, await request.json());

    const card = await prisma.$transaction(async (tx) => {
      if (payload.card_type === "debit") {
        if (!payload.linked_account_id) {
          throw new ServiceError(400, "체크카드는 연결 계좌가 필요합니다.");
        }
        await validateCheckingAccount(tx, payload.linked_account_id);
        return tx.card.create({
          data: {
            name: payload.name,
            card_type: "debit",
            institution: payload.institution ?? null,
            last_four: payload.last_four ?? null,
            linked_account_id: payload.linked_account_id,
          },
          include: CARD_INCLUDE,
        });
      }

      if (!payload.settlement_account_id || !payload.due_day) {
        throw new ServiceError(400, "신용카드는 결제 계좌와 결제일이 필요합니다.");
      }
      await validateCheckingAccount(tx, payload.settlement_account_id);

      const liability = await tx.liability.create({
        data: {
          type: "credit_card",
          name: payload.name,
          institution: payload.institution ?? null,
          current_balance: 0,
          due_day: payload.due_day,
        },
      });

      return tx.card.create({
        data: {
          name: payload.name,
          card_type: "credit",
          institution: payload.institution ?? null,
          last_four: payload.last_four ?? null,
          linked_liability_id: liability.id,
          settlement_account_id: payload.settlement_account_id,
          due_day: payload.due_day,
        },
        include: CARD_INCLUDE,
      });
    });

    return jsonOk(serializeCard(card), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
