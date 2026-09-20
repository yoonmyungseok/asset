import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import {
  serializeInvestmentTransaction,
  serializeInvestmentTransactionResponse,
} from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { ServiceError } from "@/lib/service-error";
import { updateContributedAmount } from "@/lib/services/core";
import {
  applyTransactionEffects,
  assertTransactionAllowedForAccount,
  resolveHolding,
  reverseTransactionEffects,
} from "@/lib/services/investment-transactions";
import {
  investmentTransactionCreateSchema,
  investmentTransactionUpdateSchema,
} from "@/lib/validations/account";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const accountId = parseQueryInt(params.get("account_id"));
    const holdingId = parseQueryInt(params.get("holding_id"));
    const type = params.get("type") ?? undefined;
    const fromDate = parseQueryDateBound(params.get("from_date"), "start");
    const toDate = parseQueryDateBound(params.get("to_date"), "end");
    const page = Math.max(1, parseQueryInt(params.get("page"), 1)!);
    const pageSize = Math.min(Math.max(1, parseQueryInt(params.get("page_size"), 50)!), 200);
    const sortOrder = params.get("sort_order") === "asc" ? "asc" : "desc";

    const where: Prisma.InvestmentTransactionWhereInput = {
      ...(accountId ? { account_id: accountId } : {}),
      ...(holdingId ? { holding_id: holdingId } : {}),
      ...(type ? { type } : {}),
    };

    const dateFilteredWhere = await applySqliteDateRange(
      where,
      "investment_transactions",
      fromDate,
      toDate,
    );

    const total = await prisma.investmentTransaction.count({ where: dateFilteredWhere });
    const items = await prisma.investmentTransaction.findMany({
      where: dateFilteredWhere,
      include: {
        holding: {
          select: { name: true, symbol: true },
        },
      },
      orderBy:
        sortOrder === "asc"
          ? [{ transaction_date: "asc" }, { id: "asc" }]
          : [{ transaction_date: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return jsonOk({
      items: items.map((tx) =>
        serializeInvestmentTransactionResponse(serializeInvestmentTransaction(tx)),
      ),
      total,
      page,
      page_size: pageSize,
      total_pages: pageSize ? Math.ceil(total / pageSize) : 1,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(investmentTransactionCreateSchema, await request.json());
    const account = await prisma.account.findUnique({
      where: { id: payload.account_id },
      include: { account_type: true },
    });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    assertTransactionAllowedForAccount(account, payload.type);

    const tx = await prisma.$transaction(async (db) => {
      let holding = null;

      if (payload.type === "buy" || payload.type === "sell") {
        holding = await resolveHolding(db, account, payload);
      } else if (payload.holding_id) {
        holding = await db.holding.findUnique({ where: { id: payload.holding_id } });
        if (!holding || holding.account_id !== account.id) {
          throw new ServiceError(400, "유효하지 않은 보유 종목입니다.");
        }
      }

      const created = await db.investmentTransaction.create({
        data: {
          account_id: payload.account_id,
          holding_id: holding?.id ?? null,
          type: payload.type,
          transaction_date: payload.transaction_date,
          quantity: payload.quantity ?? null,
          price: payload.price ?? null,
          amount: payload.amount,
          fee: payload.fee,
          tax: payload.tax,
          memo: payload.memo ?? null,
        },
      });

      await applyTransactionEffects(db, account, holding, created);

      if (payload.sync_to_ledger && (payload.type === "dividend" || payload.type === "interest")) {
        if (!payload.ledger_category_id) {
          throw new ServiceError(400, "가계부 연동 시 ledger_category_id가 필요합니다.");
        }
        await db.ledgerTransaction.create({
          data: {
            transaction_date: payload.transaction_date,
            type: "income",
            amount: payload.amount,
            category_id: payload.ledger_category_id,
            merchant: holding?.name ?? account.name,
            memo: payload.memo ?? `투자 ${payload.type}`,
          },
        });
      }

      return db.investmentTransaction.findUniqueOrThrow({
        where: { id: created.id },
        include: { holding: { select: { name: true, symbol: true } } },
      });
    });

    return jsonOk(
      serializeInvestmentTransactionResponse(serializeInvestmentTransaction(tx)),
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
