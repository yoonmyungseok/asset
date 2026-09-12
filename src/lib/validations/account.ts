import Decimal from "decimal.js";
import { z } from "zod";

import { ASSET_CLASS_DEPOSIT, ASSET_CLASS_STOCK } from "@/lib/utils";

export const decimalSchema = z
  .union([z.string(), z.number(), z.instanceof(Decimal)])
  .transform((value) => new Decimal(value));

export const avgCostPriceSchema = decimalSchema.transform((value) =>
  value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
);

export const bookCostSchema = decimalSchema.transform((value) =>
  value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
);

export const dateSchema = z.preprocess(
  (value) => {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }
    return value;
  },
  z.coerce.date(),
);

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    page_size: z.number().int(),
    total_pages: z.number().int(),
  });

export const accountTypeBriefSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  supports_holdings: z.boolean(),
});

export const accountTypeResponseSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  supports_holdings: z.boolean(),
  supports_contribution_limit: z.boolean(),
  sort_order: z.number().int(),
  is_system: z.boolean(),
});

export const accountTypeCreateSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  supports_holdings: z.boolean().default(false),
  supports_contribution_limit: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const accountSummarySchema = z.object({
  holdings_count: z.number().int(),
  holdings_value: decimalSchema,
  total_value: decimalSchema,
});

export const accountResponseSchema = z.object({
  id: z.number().int(),
  account_type_id: z.number().int(),
  account_type: accountTypeBriefSchema.nullable().optional(),
  name: z.string(),
  institution: z.string().nullable(),
  cash_balance: decimalSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean(),
  summary: accountSummarySchema.nullable().optional(),
});

export const accountCreateSchema = z.object({
  account_type_id: z.number().int(),
  name: z.string(),
  institution: z.string().nullable().optional(),
  cash_balance: decimalSchema.default(new Decimal(0)),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const accountUpdateSchema = z.object({
  account_type_id: z.number().int().optional(),
  name: z.string().optional(),
  institution: z.string().nullable().optional(),
  cash_balance: decimalSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const holdingResponseSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int(),
  account_name: z.string().nullable().optional(),
  asset_class: z.string(),
  symbol: z.string(),
  name: z.string(),
  quantity: decimalSchema,
  avg_cost_price: decimalSchema,
  manual_price: decimalSchema.nullable(),
  last_market_price: decimalSchema.nullable(),
  last_price_updated_at: z.coerce.date().nullable(),
  current_price: decimalSchema,
  market_value: decimalSchema,
  cost_basis: decimalSchema,
  profit_loss: decimalSchema,
  profit_loss_rate: decimalSchema,
  interest_rate: decimalSchema.nullable().optional(),
  start_date: dateSchema.nullable().optional(),
  maturity_date: dateSchema.nullable().optional(),
  accrued_interest: decimalSchema.nullable().optional(),
});

export const holdingCreateSchema = z
  .object({
    account_id: z.number().int(),
    asset_class: z.string().default(ASSET_CLASS_STOCK),
    symbol: z.string().nullable().optional(),
    name: z.string(),
    quantity: decimalSchema,
    avg_cost_price: avgCostPriceSchema.nullable().optional(),
    book_cost: bookCostSchema.nullable().optional(),
    interest_rate: decimalSchema.nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    maturity_date: dateSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.asset_class === ASSET_CLASS_DEPOSIT) {
      return;
    }
    if (!data.symbol) {
      ctx.addIssue({ code: "custom", message: "symbol이 필요합니다.", path: ["symbol"] });
    }
    if (data.avg_cost_price == null) {
      ctx.addIssue({
        code: "custom",
        message: "avg_cost_price가 필요합니다.",
        path: ["avg_cost_price"],
      });
    }
  });

export const holdingUpdateSchema = z.object({
  asset_class: z.string().optional(),
  symbol: z.string().optional(),
  name: z.string().optional(),
  quantity: decimalSchema.optional(),
  avg_cost_price: avgCostPriceSchema.optional(),
  book_cost: bookCostSchema.nullable().optional(),
  manual_price: decimalSchema.nullable().optional(),
  interest_rate: decimalSchema.nullable().optional(),
  start_date: dateSchema.nullable().optional(),
  maturity_date: dateSchema.nullable().optional(),
});

export const refreshPricesRequestSchema = z.object({
  holding_ids: z.array(z.number().int()).nullable().optional(),
});

export const refreshPricesResponseSchema = z.object({
  updated: z.number().int(),
  failed: z.array(z.record(z.string(), z.unknown())),
});

export const investmentTransactionResponseSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int(),
  holding_id: z.number().int().nullable(),
  holding_name: z.string().nullable().optional(),
  holding_symbol: z.string().nullable().optional(),
  type: z.string(),
  transaction_date: dateSchema,
  quantity: decimalSchema.nullable(),
  price: decimalSchema.nullable(),
  amount: decimalSchema,
  fee: decimalSchema,
  tax: decimalSchema,
  memo: z.string().nullable(),
});

export const investmentTransactionCreateSchema = z.object({
  account_id: z.number().int(),
  holding_id: z.number().int().nullable().optional(),
  asset_class: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  type: z.string(),
  transaction_date: dateSchema,
  quantity: decimalSchema.nullable().optional(),
  price: decimalSchema.nullable().optional(),
  amount: decimalSchema,
  fee: decimalSchema.default(new Decimal(0)),
  tax: decimalSchema.default(new Decimal(0)),
  memo: z.string().nullable().optional(),
  sync_to_ledger: z.boolean().default(false),
  ledger_category_id: z.number().int().nullable().optional(),
});

export const investmentTransactionUpdateSchema = z.object({
  type: z.string().optional(),
  transaction_date: dateSchema.optional(),
  quantity: decimalSchema.optional(),
  price: decimalSchema.optional(),
  amount: decimalSchema.optional(),
  fee: decimalSchema.optional(),
  tax: decimalSchema.optional(),
  memo: z.string().nullable().optional(),
});

export const accountLimitResponseSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int(),
  account_name: z.string().nullable().optional(),
  year: z.number().int(),
  contribution_limit: decimalSchema,
  contributed_amount: decimalSchema,
  remaining_amount: decimalSchema,
  usage_rate: decimalSchema,
});

export const accountLimitUpsertSchema = z.object({
  account_id: z.number().int(),
  year: z.number().int(),
  contribution_limit: decimalSchema,
});

export type AccountTypeBrief = z.infer<typeof accountTypeBriefSchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type HoldingResponse = z.infer<typeof holdingResponseSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type AccountLimitResponse = z.infer<typeof accountLimitResponseSchema>;
export type InvestmentTransactionResponse = z.infer<typeof investmentTransactionResponseSchema>;
