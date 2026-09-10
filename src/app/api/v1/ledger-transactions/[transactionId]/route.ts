import type { NextRequest } from "next/server";

import { serializeLedgerTransaction } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import {
  deleteLedgerTransaction,
  updateLedgerTransaction,
} from "@/lib/services/ledger-transactions";
import { ledgerTransactionUpdateSchema } from "@/lib/validations/ledger";

type RouteContext = { params: Promise<{ transactionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { transactionId: idRaw } = await context.params;
    const transactionId = Number.parseInt(idRaw, 10);
    const payload = parseJsonBody(ledgerTransactionUpdateSchema, await request.json());
    const tx = await updateLedgerTransaction(transactionId, payload);
    return jsonOk(serializeLedgerTransaction(tx));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { transactionId: idRaw } = await context.params;
    const transactionId = Number.parseInt(idRaw, 10);
    await deleteLedgerTransaction(transactionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
