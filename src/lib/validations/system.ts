import { z } from "zod";

import { dateSchema, decimalSchema } from "@/lib/validations/account";

export const accountSnapshotPointSchema = z.object({
  snapshot_date: dateSchema,
  balance_value: decimalSchema,
});

export const dailySnapshotResponseSchema = z.object({
  id: z.number().int(),
  snapshot_date: dateSchema,
  total_assets: decimalSchema,
  total_liabilities: decimalSchema,
  net_worth: decimalSchema,
  investment_total: decimalSchema,
  cash_total: decimalSchema,
});

export const marketQuoteResponseSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  price: decimalSchema,
  currency: z.string(),
  updated_at: z.coerce.date().nullable(),
});

export const marketSearchItemSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

export const marketProviderStatusSchema = z.object({
  provider: z.string(),
  configured: z.boolean(),
  connected: z.boolean(),
  message: z.string().nullable().optional(),
});

export const tossCredentialsUpdateSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
});

export const healthResponseSchema = z.object({
  status: z.string(),
  db: z.string(),
  version: z.string(),
});

export const initializeResponseSchema = z.object({
  account_types: z.number().int(),
  payment_methods: z.number().int(),
  categories: z.number().int(),
  message: z.string(),
});

export const restoreResponseSchema = z.object({
  message: z.string(),
  restored_at: z.coerce.date(),
});

export type MarketQuoteResponse = z.infer<typeof marketQuoteResponseSchema>;
export type MarketSearchItem = z.infer<typeof marketSearchItemSchema>;
