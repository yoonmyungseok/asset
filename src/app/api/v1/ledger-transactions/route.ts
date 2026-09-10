import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import {
  LEDGER_TX_INCLUDE,
  serializeLedgerTransaction,
} from "@/lib/api/serializers";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryBool,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { getCategoryDescendantIds } from "@/lib/services/core";
import {
  createLedgerTransaction,
  deleteLedgerTransaction,
  updateLedgerTransaction,
} from "@/lib/services/ledger-transactions";
import {
  ledgerTransactionCreateSchema,
  ledgerTransactionUpdateSchema,
} from "@/lib/validations/ledger";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? undefined;
    const categoryId = parseQueryInt(params.get("category_id"));
    const includeSubcategories = parseQueryBool(params.get("include_subcategories")) ?? true;
    const paymentMethodId = parseQueryInt(params.get("payment_method_id"));
    const accountId = parseQueryInt(params.get("account_id"));
    const cardId = parseQueryInt(params.get("card_id"));
    const isFixed = parseQueryBool(params.get("is_fixed"));
    const tag = params.get("tag") ?? undefined;
    const q = params.get("q") ?? undefined;
    const fromDate = parseQueryDateBound(params.get("from_date"), "start");
    const toDate = parseQueryDateBound(params.get("to_date"), "end");
    const page = parseQueryInt(params.get("page"), 1)!;
    const pageSize = Math.min(parseQueryInt(params.get("page_size"), 50)!, 200);
    const sortOrder = params.get("sort_order") === "asc" ? "asc" : "desc";

    const where: Prisma.LedgerTransactionWhereInput = {};

    if (type) {
      where.type = type;
    }
    if (categoryId != null) {
      if (includeSubcategories) {
        const ids = await getCategoryDescendantIds(prisma, categoryId);
        where.category_id = { in: ids };
      } else {
        where.category_id = categoryId;
      }
    }
    if (paymentMethodId != null) {
      where.payment_method_id = paymentMethodId;
    }
    if (accountId != null) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ account_id: accountId }, { to_account_id: accountId }] },
      ];
    }
    if (cardId != null) {
      where.card_id = cardId;
    }
    if (isFixed != null) {
      where.is_fixed = isFixed;
    }
    if (tag) {
      where.tags = { some: { tag: { name: tag } } };
    }
    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ memo: { contains: q } }, { merchant: { contains: q } }] },
      ];
    }
    const dateFilteredWhere = await applySqliteDateRange(
      where,
      "ledger_transactions",
      fromDate,
      toDate,
    );

    const total = await prisma.ledgerTransaction.count({ where: dateFilteredWhere });
    const items = await prisma.ledgerTransaction.findMany({
      where: dateFilteredWhere,
      include: LEDGER_TX_INCLUDE,
      orderBy:
        sortOrder === "asc"
          ? [{ transaction_date: "asc" }, { id: "asc" }]
          : [{ transaction_date: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = pageSize ? Math.ceil(total / pageSize) : 1;

    return jsonOk({
      items: items.map(serializeLedgerTransaction),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(ledgerTransactionCreateSchema, await request.json());
    const tx = await createLedgerTransaction(payload);
    return jsonOk(serializeLedgerTransaction(tx), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
