import { z } from "zod";

import { dateSchema, decimalSchema } from "@/lib/validations/account";
import { budgetAlertItemSchema } from "@/lib/validations/ledger";

export const netWorthSummarySchema = z.object({
  total_assets: decimalSchema,
  total_liabilities: decimalSchema,
  net_worth: decimalSchema,
});

export const assetBreakdownSchema = z.object({
  investment: decimalSchema,
  cash: decimalSchema,
  investment_ratio: decimalSchema,
  cash_ratio: decimalSchema,
});

export const cashflowSummarySchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  total_income: decimalSchema,
  total_expense: decimalSchema,
  net: decimalSchema,
});

export const accountOverviewItemSchema = z.object({
  account_id: z.number().int(),
  name: z.string(),
  type: z.string(),
  category: z.string(),
  total_value: decimalSchema,
  ratio: decimalSchema,
});

export const limitAlertSchema = z.object({
  account_name: z.string(),
  usage_rate: decimalSchema,
  remaining: decimalSchema,
});

export const netWorthDeltaSchema = z.object({
  previous_date: dateSchema,
  change_amount: decimalSchema,
  change_rate: decimalSchema,
});

export const cashflowComparisonSchema = z.object({
  prev_month_income: decimalSchema,
  prev_month_expense: decimalSchema,
  income_change_rate: decimalSchema.optional(),
  expense_change_rate: decimalSchema,
});

export const dashboardInsightsSchema = z.object({
  savings_rate: decimalSchema.nullable(),
  emergency_months: decimalSchema.nullable(),
  debt_ratio: decimalSchema.nullable(),
});

export const dashboardOverviewSchema = z.object({
  as_of: z.coerce.date(),
  net_worth: netWorthSummarySchema,
  net_worth_delta: netWorthDeltaSchema.nullable(),
  asset_breakdown: assetBreakdownSchema,
  cashflow: cashflowSummarySchema,
  cashflow_comparison: cashflowComparisonSchema.nullable(),
  accounts_summary: z.array(accountOverviewItemSchema),
  budget_alerts: z.array(budgetAlertItemSchema),
  budget_alerts_count: z.number().int(),
  limit_alerts: z.array(limitAlertSchema),
  insights: dashboardInsightsSchema,
});

export const trendPointSchema = z.object({
  date: dateSchema,
  total_assets: decimalSchema,
  total_liabilities: decimalSchema,
  net_worth: decimalSchema,
});

export const netWorthTrendResponseSchema = z.object({
  data: z.array(trendPointSchema),
});

export const cashflowTrendPointSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  income: decimalSchema,
  expense: decimalSchema,
  net: decimalSchema,
});

export const cashflowTrendResponseSchema = z.object({
  data: z.array(cashflowTrendPointSchema),
});

export const accountPerformanceItemSchema = z.object({
  account_id: z.number().int(),
  name: z.string(),
  cost_basis: decimalSchema,
  market_value: decimalSchema,
  profit_loss: decimalSchema,
  profit_loss_rate: decimalSchema,
});

export const dashboardRefreshResponseSchema = z.object({
  prices_updated: z.number().int(),
  recurring_generated: z.number().int(),
  snapshot_saved: z.boolean(),
});
