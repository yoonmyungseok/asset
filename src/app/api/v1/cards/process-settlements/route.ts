import type { NextRequest } from "next/server";

import { serializeCardSettlement } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseOptionalDate } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { processDueCardPayments } from "@/lib/services/card-payments";

export async function POST(request: NextRequest) {
  try {
    const asOfRaw = request.nextUrl.searchParams.get("as_of");
    const asOf = parseOptionalDate(asOfRaw);

    const settlements = await processDueCardPayments(asOf);
    if (settlements.length === 0) {
      return jsonOk([]);
    }

    const rows = await prisma.cardSettlement.findMany({
      where: { id: { in: settlements.map((item) => item.id) } },
      include: { card: { select: { name: true } } },
    });

    return jsonOk(rows.map(serializeCardSettlement));
  } catch (error) {
    return handleRouteError(error);
  }
}
