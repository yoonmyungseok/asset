import Decimal from "decimal.js";
import { z } from "zod";

import { dateSchema, decimalSchema } from "@/lib/validations/account";

export const liabilityResponseSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  name: z.string(),
  institution: z.string().nullable(),
  original_amount: decimalSchema,
  current_balance: decimalSchema,
  interest_rate: decimalSchema.nullable(),
  due_day: z.number().int().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
});

export const liabilityCreateSchema = z.object({
  type: z.string(),
  name: z.string(),
  institution: z.string().nullable().optional(),
  original_amount: decimalSchema.default(new Decimal(0)),
  current_balance: decimalSchema,
  interest_rate: decimalSchema.nullable().optional(),
  due_day: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const liabilityUpdateSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  institution: z.string().nullable().optional(),
  original_amount: decimalSchema.optional(),
  current_balance: decimalSchema.optional(),
  interest_rate: decimalSchema.nullable().optional(),
  due_day: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const liabilityTransactionResponseSchema = z.object({
  id: z.number().int(),
  liability_id: z.number().int(),
  transaction_date: dateSchema,
  type: z.string(),
  amount: decimalSchema,
  memo: z.string().nullable(),
});

export const liabilityTransactionCreateSchema = z.object({
  transaction_date: dateSchema,
  type: z.string(),
  amount: decimalSchema,
  memo: z.string().nullable().optional(),
});

export type LiabilityResponse = z.infer<typeof liabilityResponseSchema>;
export type LiabilityTransactionResponse = z.infer<typeof liabilityTransactionResponseSchema>;
