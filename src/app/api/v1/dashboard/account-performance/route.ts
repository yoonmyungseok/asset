import type { NextRequest } from "next/server";
import Decimal from "decimal.js";

import { handleRouteError, jsonOk, parseQueryInt } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import { holdingCostBasis, holdingMarketValue } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const accountId = parseQueryInt(request.nextUrl.searchParams.get("account_id"));

    const accounts = await prisma.account.findMany({
      where: {
        is_active: true,
        ...(accountId != null ? { id: accountId } : {}),
      },
      include: { account_type: true },
    });

    const results = [];
    for (const account of accounts) {
      if (!account.account_type.supports_holdings) {
        continue;
      }

      const holdings = await prisma.holding.findMany({
        where: { account_id: account.id, quantity: { gt: 0 } },
      });

      const marketValue = holdings.reduce(
        (sum, holding) => sum.plus(holdingMarketValue(holding)),
        new Decimal(0),
      );
      const costBasis = holdings.reduce(
        (sum, holding) => sum.plus(holdingCostBasis(holding)),
        new Decimal(0),
      );
      const profitLoss = marketValue.minus(costBasis);
      const profitLossRate = costBasis.gt(0)
        ? profitLoss.div(costBasis).times(100)
        : new Decimal(0);

      results.push({
        account_id: account.id,
        name: account.name,
        cost_basis: costBasis,
        market_value: marketValue.plus(toDecimal(account.cash_balance)),
        profit_loss: profitLoss,
        profit_loss_rate: profitLossRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      });
    }

    return jsonOk(results);
  } catch (error) {
    return handleRouteError(error);
  }
}
