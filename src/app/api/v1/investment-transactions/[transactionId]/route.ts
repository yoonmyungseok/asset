import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  serializeInvestmentTransaction,
  serializeInvestmentTransactionResponse,
} from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { updateContributedAmount } from "@/lib/services/core";
import { reverseTransactionEffects } from "@/lib/services/investment-transactions";
import { investmentTransactionUpdateSchema } from "@/lib/validations/account";

type RouteParams = { params: Promise<{ transactionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { transactionId: transactionIdParam } = await params;
    const tx = await prisma.investmentTransaction.findUnique({
      where: { id: Number(transactionIdParam) },
    });
    if (!tx) {
      return apiError(404, "거래를 찾을 수 없습니다.");
    }
    return jsonOk(
      serializeInvestmentTransactionResponse(serializeInvestmentTransaction(tx)),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { transactionId: transactionIdParam } = await params;
    const txId = Number(transactionIdParam);
    const payload = parseJsonBody(investmentTransactionUpdateSchema, await request.json());

    const existing = await prisma.investmentTransaction.findUnique({ where: { id: txId } });
    if (!existing) {
      return apiError(404, "거래를 찾을 수 없습니다.");
    }

    const updated = await prisma.investmentTransaction.update({
      where: { id: txId },
      data: payload,
    });

    await updateContributedAmount(prisma, updated.account_id, updated.transaction_date.getFullYear());
    return jsonOk(
      serializeInvestmentTransactionResponse(serializeInvestmentTransaction(updated)),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { transactionId: transactionIdParam } = await params;
    const txId = Number(transactionIdParam);

    const tx = await prisma.investmentTransaction.findUnique({ where: { id: txId } });
    if (!tx) {
      return apiError(404, "거래를 찾을 수 없습니다.");
    }

    const account = await prisma.account.findUnique({ where: { id: tx.account_id } });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    const accountId = tx.account_id;
    const year = tx.transaction_date.getFullYear();

    await prisma.$transaction(async (db) => {
      await reverseTransactionEffects(db, account, tx);
      await db.investmentTransaction.delete({ where: { id: txId } });
    });

    await updateContributedAmount(prisma, accountId, year);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
