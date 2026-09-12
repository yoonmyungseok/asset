import type {
  Budget,
  Card,
  CardSettlement,
  Category,
  Holding,
  InvestmentTransaction,
  LedgerTransaction,
  Liability,
  LiabilityTransaction,
  PaymentMethod,
  RecurringItem,
} from "@prisma/client";
import Decimal from "decimal.js";

import { formatDateOnly } from "@/lib/api/route-utils";
import { roundAvgCostPriceDisplay, toDecimal } from "@/lib/decimal";
import { holdingToResponse } from "@/lib/services/core";
import type {
  AccountLimitResponse,
  AccountResponse,
  HoldingResponse,
  InvestmentTransactionResponse,
} from "@/lib/validations/account";
import type {
  CardBrief,
  CardResponse,
  CardSettlementResponse,
} from "@/lib/validations/card";
import type {
  BudgetResponse,
  CategoryBrief,
  LedgerTransactionResponse,
  RecurringItemResponse,
} from "@/lib/validations/ledger";
import type {
  LiabilityResponse,
  LiabilityTransactionResponse,
} from "@/lib/validations/liability";

type CategoryWithParent = Category & { parent?: Category | null };
type CardWithRelations = Card & {
  linked_account?: { name: string } | null;
  settlement_account?: { name: string } | null;
  linked_liability?: { name: string } | null;
};
type LedgerTxWithRelations = LedgerTransaction & {
  category: CategoryWithParent;
  payment_method?: PaymentMethod | null;
  account?: { name: string } | null;
  to_account?: { name: string } | null;
  card?: Card | null;
  tags?: Array<{ tag: { name: string } }>;
};
type RecurringItemWithRelations = RecurringItem & {
  category: CategoryWithParent;
  payment_method?: PaymentMethod | null;
  account?: { name: string } | null;
  to_account?: { name: string } | null;
  card?: Card | null;
};
type BudgetWithCategory = Budget & { category?: Category | null };

export function serializeCategoryBrief(category: CategoryWithParent): CategoryBrief {
  return {
    id: category.id,
    name: category.name,
    parent_name: category.parent?.name ?? null,
  };
}

export function serializeCardBrief(card: Card): CardBrief {
  return {
    id: card.id,
    name: card.name,
    card_type: card.card_type,
    institution: card.institution,
    last_four: card.last_four,
  };
}

export function serializeCard(card: CardWithRelations): CardResponse {
  return {
    id: card.id,
    name: card.name,
    card_type: card.card_type,
    institution: card.institution,
    last_four: card.last_four,
    linked_account_id: card.linked_account_id,
    linked_account_name: card.linked_account?.name ?? null,
    linked_liability_id: card.linked_liability_id,
    linked_liability_name: card.linked_liability?.name ?? null,
    settlement_account_id: card.settlement_account_id,
    settlement_account_name: card.settlement_account?.name ?? null,
    due_day: card.due_day,
    is_active: card.is_active,
  };
}

export function serializeCardSettlement(
  item: CardSettlement & { card: { name: string } },
): CardSettlementResponse {
  return {
    id: item.id,
    card_id: item.card_id,
    card_name: item.card.name,
    year: item.year,
    month: item.month,
    amount: toDecimal(item.amount),
    settlement_date: item.settlement_date,
  };
}

export function serializeLedgerTransaction(tx: LedgerTxWithRelations): LedgerTransactionResponse {
  const transactionDate =
    tx.transaction_date instanceof Date ? tx.transaction_date : new Date(tx.transaction_date);
  return {
    id: tx.id,
    transaction_date: formatDateOnly(transactionDate),
    type: tx.type,
    amount: toDecimal(tx.amount),
    category: serializeCategoryBrief(tx.category),
    payment_method: tx.payment_method
      ? { id: tx.payment_method.id, name: tx.payment_method.name }
      : null,
    account_id: tx.account_id,
    to_account_id: tx.to_account_id,
    account_name: tx.account?.name ?? null,
    to_account_name: tx.to_account?.name ?? null,
    card: tx.card ? serializeCardBrief(tx.card) : null,
    merchant: tx.merchant,
    memo: tx.memo,
    is_fixed: tx.is_fixed,
    tags: (tx.tags ?? []).map((entry) => entry.tag.name),
  };
}

export function serializeRecurringItem(item: RecurringItemWithRelations): RecurringItemResponse {
  return {
    id: item.id,
    type: item.type,
    amount: toDecimal(item.amount),
    category: serializeCategoryBrief(item.category),
    payment_method: item.payment_method
      ? { id: item.payment_method.id, name: item.payment_method.name }
      : null,
    account_id: item.account_id,
    to_account_id: item.to_account_id,
    account_name: item.account?.name ?? null,
    to_account_name: item.to_account?.name ?? null,
    card: item.card ? serializeCardBrief(item.card) : null,
    merchant: item.merchant,
    memo: item.memo,
    frequency: item.frequency,
    day_of_month: item.day_of_month,
    is_active: item.is_active,
  };
}

export function serializeBudgetResponse(
  budget: BudgetWithCategory,
  spent: Decimal,
): BudgetResponse {
  const amount = toDecimal(budget.amount);
  const remaining = amount.minus(spent);
  const usageRate = amount.gt(0) ? spent.div(amount).times(100) : new Decimal(0);
  return {
    id: budget.id,
    category_id: budget.category_id,
    category_name: budget.category?.name ?? "",
    year: budget.year,
    month: budget.month,
    amount,
    spent,
    remaining,
    usage_rate: usageRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    over_budget: spent.gt(amount),
  };
}

export function serializeLiability(liability: Liability): LiabilityResponse {
  return {
    id: liability.id,
    type: liability.type,
    name: liability.name,
    institution: liability.institution,
    original_amount: toDecimal(liability.original_amount),
    current_balance: toDecimal(liability.current_balance),
    interest_rate: liability.interest_rate != null ? toDecimal(liability.interest_rate) : null,
    due_day: liability.due_day,
    notes: liability.notes,
    is_active: liability.is_active,
  };
}

export function serializeLiabilityTransaction(tx: LiabilityTransaction): LiabilityTransactionResponse {
  return {
    id: tx.id,
    liability_id: tx.liability_id,
    transaction_date: tx.transaction_date,
    type: tx.type,
    amount: toDecimal(tx.amount),
    memo: tx.memo,
  };
}

export const CARD_INCLUDE = {
  linked_account: { select: { name: true } },
  settlement_account: { select: { name: true } },
  linked_liability: { select: { name: true } },
} as const;

export const LEDGER_TX_INCLUDE = {
  category: { include: { parent: true } },
  payment_method: true,
  account: { select: { name: true } },
  to_account: { select: { name: true } },
  card: true,
  tags: { include: { tag: true } },
} as const;

export const RECURRING_ITEM_INCLUDE = {
  category: { include: { parent: true } },
  payment_method: true,
  account: { select: { name: true } },
  to_account: { select: { name: true } },
  card: true,
} as const;

export function monthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function serializeDecimalField(value: Decimal.Value | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return toDecimal(value).toFixed();
}

export function serializeAccountResponse(account: AccountResponse) {
  return {
    ...account,
    cash_balance: serializeDecimalField(account.cash_balance),
    summary: account.summary
      ? {
          ...account.summary,
          holdings_value: serializeDecimalField(account.summary.holdings_value),
          total_value: serializeDecimalField(account.summary.total_value),
        }
      : account.summary,
  };
}

export function serializeHoldingResponse(holding: HoldingResponse) {
  return {
    ...holding,
    quantity: serializeDecimalField(holding.quantity),
    avg_cost_price: serializeDecimalField(roundAvgCostPriceDisplay(holding.avg_cost_price)),
    manual_price: serializeDecimalField(holding.manual_price),
    last_market_price: serializeDecimalField(holding.last_market_price),
    last_price_updated_at: holding.last_price_updated_at?.toISOString() ?? null,
    current_price: serializeDecimalField(holding.current_price),
    market_value: serializeDecimalField(holding.market_value),
    cost_basis: serializeDecimalField(holding.cost_basis),
    profit_loss: serializeDecimalField(holding.profit_loss),
    profit_loss_rate: serializeDecimalField(holding.profit_loss_rate),
    interest_rate: serializeDecimalField(holding.interest_rate),
    start_date: holding.start_date
      ? formatDateOnly(
          holding.start_date instanceof Date ? holding.start_date : new Date(holding.start_date),
        )
      : null,
    maturity_date: holding.maturity_date
      ? formatDateOnly(
          holding.maturity_date instanceof Date
            ? holding.maturity_date
            : new Date(holding.maturity_date),
        )
      : null,
    accrued_interest: serializeDecimalField(holding.accrued_interest),
  };
}

export function serializeHoldingModel(holding: Holding, accountName?: string | null) {
  return serializeHoldingResponse(holdingToResponse(holding, accountName));
}

type InvestmentTransactionWithHolding = InvestmentTransaction & {
  holding?: { name: string; symbol: string } | null;
};

export function serializeInvestmentTransaction(
  tx: InvestmentTransactionWithHolding,
): InvestmentTransactionResponse {
  return {
    id: tx.id,
    account_id: tx.account_id,
    holding_id: tx.holding_id,
    holding_name: tx.holding?.name ?? null,
    holding_symbol: tx.holding?.symbol ?? null,
    type: tx.type,
    transaction_date: tx.transaction_date,
    quantity: tx.quantity != null ? toDecimal(tx.quantity) : null,
    price: tx.price != null ? toDecimal(tx.price) : null,
    amount: toDecimal(tx.amount),
    fee: toDecimal(tx.fee),
    tax: toDecimal(tx.tax),
    memo: tx.memo,
  };
}

export function serializeInvestmentTransactionResponse(tx: InvestmentTransactionResponse) {
  const transactionDate =
    tx.transaction_date instanceof Date ? tx.transaction_date : new Date(tx.transaction_date);
  return {
    ...tx,
    transaction_date: formatDateOnly(transactionDate),
    quantity: serializeDecimalField(tx.quantity),
    price: serializeDecimalField(tx.price),
    amount: serializeDecimalField(tx.amount),
    fee: serializeDecimalField(tx.fee),
    tax: serializeDecimalField(tx.tax),
  };
}

export function serializeAccountLimit(limit: AccountLimitResponse) {
  return {
    ...limit,
    contribution_limit: serializeDecimalField(limit.contribution_limit),
    contributed_amount: serializeDecimalField(limit.contributed_amount),
    remaining_amount: serializeDecimalField(limit.remaining_amount),
    usage_rate: serializeDecimalField(limit.usage_rate),
  };
}

export function buildAccountLimitResponse(
  limit: {
    id: number;
    account_id: number;
    year: number;
    contribution_limit: Decimal.Value;
    contributed_amount: Decimal.Value;
    account?: { name: string } | null;
  },
): AccountLimitResponse {
  const contributionLimit = toDecimal(limit.contribution_limit);
  const contributed = toDecimal(limit.contributed_amount);
  const remaining = contributionLimit.minus(contributed);
  const usageRate = contributionLimit.gt(0)
    ? contributed.div(contributionLimit).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);

  return {
    id: limit.id,
    account_id: limit.account_id,
    account_name: limit.account?.name ?? null,
    year: limit.year,
    contribution_limit: contributionLimit,
    contributed_amount: contributed,
    remaining_amount: remaining,
    usage_rate: usageRate,
  };
}
