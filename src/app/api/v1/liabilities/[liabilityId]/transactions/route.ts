import type { NextRequest } from "next/server";

import { serializeLiabilityTransaction } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import { ServiceError } from "@/lib/service-error";
import { liabilityTransactionCreateSchema } from "@/lib/validations/liability";

type RouteContext = { params: Promise<{ liabilityId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { liabilityId: idRaw } = await context.params;
    const liabilityId = Number.parseInt(idRaw, 10);

    const liability = await prisma.liability.findUnique({ where: { id: liabilityId } });
    if (!liability) {
      throw new ServiceError(404, "부채를 찾을 수 없습니다.");
    }

    const transactions = await prisma.liabilityTransaction.findMany({
      where: { liability_id: liabilityId },
      orderBy: { transaction_date: "desc" },
    });

    return jsonOk(transactions.map(serializeLiabilityTransaction));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { liabilityId: idRaw } = await context.params;
    const liabilityId = Number.parseInt(idRaw, 10);
    const payload = parseJsonBody(liabilityTransactionCreateSchema, await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const liability = await tx.liability.findUnique({ where: { id: liabilityId } });
      if (!liability) {
        throw new ServiceError(404, "부채를 찾을 수 없습니다.");
      }

      const txRecord = await tx.liabilityTransaction.create({
        data: {
          liability_id: liabilityId,
          transaction_date: payload.transaction_date,
          type: payload.type,
          amount: payload.amount,
          memo: payload.memo ?? null,
        },
      });

      let newBalance = toDecimal(liability.current_balance);
      if (payload.type === "payment") {
        newBalance = newBalance.minus(toDecimal(payload.amount));
      } else if (payload.type === "charge" || payload.type === "interest") {
        newBalance = newBalance.plus(toDecimal(payload.amount));
      }

      await tx.liability.update({
        where: { id: liabilityId },
        data: { current_balance: newBalance },
      });

      return txRecord;
    });

    return jsonOk(serializeLiabilityTransaction(result), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
