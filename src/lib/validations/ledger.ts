import { z } from "zod";

import { dateSchema, decimalSchema } from "@/lib/validations/account";
import { cardBriefSchema } from "@/lib/validations/card";

export const categoryChildSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  parent_id: z.number().int().nullable(),
  type: z.string(),
  sort_order: z.number().int(),
  is_system: z.boolean(),
  is_active: z.boolean(),
});

export const categoryTreeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  parent_id: z.number().int().nullable(),
  sort_order: z.number().int(),
  is_system: z.boolean(),
  is_active: z.boolean(),
  children: z.array(categoryChildSchema).default([]),
});

export const categoryResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  parent_id: z.number().int().nullable(),
  sort_order: z.number().int(),
  is_system: z.boolean(),
  is_active: z.boolean(),
});

export const categoryCreateSchema = z.object({
  name: z.string(),
  type: z.string(),
  parent_id: z.number().int().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const categoryUpdateSchema = z.object({
  name: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const paymentMethodResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  is_system: z.boolean(),
});

export const paymentMethodCreateSchema = z.object({
  name: z.string(),
});

export const categoryBriefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  parent_name: z.string().nullable().optional(),
});

export const paymentMethodBriefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const ledgerTransactionResponseSchema = z.object({
  id: z.number().int(),
  transaction_date: z.string(),
  type: z.string(),
  amount: decimalSchema,
  category: categoryBriefSchema,
  payment_method: paymentMethodBriefSchema.nullable().optional(),
  account_id: z.number().int().nullable(),
  to_account_id: z.number().int().nullable(),
  account_name: z.string().nullable().optional(),
  to_account_name: z.string().nullable().optional(),
  card: cardBriefSchema.nullable().optional(),
  merchant: z.string().nullable(),
  memo: z.string().nullable(),
  is_fixed: z.boolean(),
  tags: z.array(z.string()).default([]),
});

export const ledgerTransactionCreateSchema = z.object({
  transaction_date: dateSchema,
  type: z.string(),
  amount: decimalSchema,
  category_id: z.number().int().nullable().optional(),
  payment_method_id: z.number().int().nullable().optional(),
  account_id: z.number().int().nullable().optional(),
  to_account_id: z.number().int().nullable().optional(),
  card_id: z.number().int().nullable().optional(),
  merchant: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  is_fixed: z.boolean().default(false),
  tag_names: z.array(z.string()).default([]),
});

export const ledgerTransactionUpdateSchema = z.object({
  transaction_date: dateSchema.optional(),
  type: z.string().optional(),
  amount: decimalSchema.optional(),
  category_id: z.number().int().nullable().optional(),
  payment_method_id: z.number().int().nullable().optional(),
  account_id: z.number().int().nullable().optional(),
  to_account_id: z.number().int().nullable().optional(),
  card_id: z.number().int().nullable().optional(),
  merchant: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  is_fixed: z.boolean().optional(),
  tag_names: z.array(z.string()).nullable().optional(),
});

export const ledgerSummaryCategorySchema = z.object({
  category_id: z.number().int(),
  category_name: z.string(),
  parent_name: z.string().nullable(),
  amount: decimalSchema,
  ratio: decimalSchema,
  budget: decimalSchema.nullable().optional(),
  over_budget: z.boolean().default(false),
});

export const ledgerSummaryComparisonSchema = z.object({
  prev_month_expense: decimalSchema,
  expense_change_rate: decimalSchema,
});

export const ledgerSummaryCardSchema = z.object({
  card_id: z.number().int(),
  card_name: z.string(),
  card_type: z.string(),
  institution: z.string().nullable().optional(),
  last_four: z.string().nullable().optional(),
  amount: decimalSchema,
  ratio: decimalSchema,
});

export const ledgerSummaryResponseSchema = z.object({
  period: z.object({ year: z.number().int(), month: z.number().int() }),
  total_income: decimalSchema,
  total_expense: decimalSchema,
  net_cashflow: decimalSchema,
  by_category: z.array(ledgerSummaryCategorySchema),
  by_card: z.array(ledgerSummaryCardSchema).default([]),
  comparison: ledgerSummaryComparisonSchema.nullable().optional(),
});

export const tagResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  usage_count: z.number().int(),
});

export const tagCreateSchema = z.object({
  name: z.string(),
});

export const recurringItemResponseSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  amount: decimalSchema,
  category: categoryBriefSchema,
  payment_method: paymentMethodBriefSchema.nullable().optional(),
  account_id: z.number().int().nullable().optional(),
  to_account_id: z.number().int().nullable().optional(),
  account_name: z.string().nullable().optional(),
  to_account_name: z.string().nullable().optional(),
  card: cardBriefSchema.nullable().optional(),
  merchant: z.string().nullable(),
  memo: z.string().nullable(),
  frequency: z.string(),
  day_of_month: z.number().int(),
  is_active: z.boolean(),
});

export const recurringItemCreateSchema = z.object({
  type: z.string(),
  amount: decimalSchema,
  category_id: z.number().int(),
  payment_method_id: z.number().int().nullable().optional(),
  account_id: z.number().int().nullable().optional(),
  to_account_id: z.number().int().nullable().optional(),
  card_id: z.number().int().nullable().optional(),
  merchant: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  frequency: z.string().default("monthly"),
  day_of_month: z.number().int().default(1),
});

export const recurringItemUpdateSchema = z.object({
  type: z.string().optional(),
  amount: decimalSchema.optional(),
  category_id: z.number().int().optional(),
  payment_method_id: z.number().int().nullable().optional(),
  account_id: z.number().int().nullable().optional(),
  to_account_id: z.number().int().nullable().optional(),
  card_id: z.number().int().nullable().optional(),
  merchant: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  frequency: z.string().optional(),
  day_of_month: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const recurringGenerateRequestSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
});

export const recurringGenerateItemSchema = z.object({
  recurring_item_id: z.number().int(),
  ledger_transaction_id: z.number().int().nullable().optional(),
  status: z.string(),
});

export const recurringGenerateResponseSchema = z.object({
  generated: z.number().int(),
  skipped: z.number().int(),
  items: z.array(recurringGenerateItemSchema),
});

export const budgetResponseSchema = z.object({
  id: z.number().int(),
  category_id: z.number().int(),
  category_name: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  amount: decimalSchema,
  spent: decimalSchema,
  remaining: decimalSchema,
  usage_rate: decimalSchema,
  over_budget: z.boolean(),
});

export const budgetUpsertSchema = z.object({
  category_id: z.number().int(),
  year: z.number().int(),
  month: z.number().int(),
  amount: decimalSchema,
});

export const budgetAlertItemSchema = z.object({
  category_name: z.string(),
  budget: decimalSchema,
  spent: decimalSchema,
  over_amount: decimalSchema.nullable().optional(),
  usage_rate: decimalSchema.nullable().optional(),
});

export const budgetAlertsResponseSchema = z.object({
  over_budget: z.array(budgetAlertItemSchema),
  near_limit: z.array(budgetAlertItemSchema),
});

export type BudgetAlertsResponse = z.infer<typeof budgetAlertsResponseSchema>;
export type BudgetAlertItem = z.infer<typeof budgetAlertItemSchema>;
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
export type CategoryBrief = z.infer<typeof categoryBriefSchema>;
export type LedgerTransactionResponse = z.infer<typeof ledgerTransactionResponseSchema>;
export type RecurringItemResponse = z.infer<typeof recurringItemResponseSchema>;
