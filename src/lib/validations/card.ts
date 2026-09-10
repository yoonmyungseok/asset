import { z } from "zod";

import { dateSchema, decimalSchema } from "@/lib/validations/account";

export const cardBriefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  card_type: z.string(),
  institution: z.string().nullable().optional(),
  last_four: z.string().nullable().optional(),
});

export const cardResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  card_type: z.string(),
  institution: z.string().nullable(),
  last_four: z.string().nullable(),
  linked_account_id: z.number().int().nullable(),
  linked_account_name: z.string().nullable().optional(),
  linked_liability_id: z.number().int().nullable(),
  linked_liability_name: z.string().nullable().optional(),
  settlement_account_id: z.number().int().nullable(),
  settlement_account_name: z.string().nullable().optional(),
  due_day: z.number().int().nullable(),
  is_active: z.boolean(),
});

export const cardCreateSchema = z.object({
  name: z.string(),
  card_type: z.enum(["debit", "credit"]),
  institution: z.string().nullable().optional(),
  last_four: z.string().max(4).nullable().optional(),
  linked_account_id: z.number().int().nullable().optional(),
  settlement_account_id: z.number().int().nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

export const cardUpdateSchema = z.object({
  name: z.string().optional(),
  institution: z.string().nullable().optional(),
  last_four: z.string().max(4).nullable().optional(),
  linked_account_id: z.number().int().nullable().optional(),
  settlement_account_id: z.number().int().nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const cardSettlementResponseSchema = z.object({
  id: z.number().int(),
  card_id: z.number().int(),
  card_name: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  amount: decimalSchema,
  settlement_date: dateSchema,
});

export type CardBrief = z.infer<typeof cardBriefSchema>;
export type CardResponse = z.infer<typeof cardResponseSchema>;
export type CardSettlementResponse = z.infer<typeof cardSettlementResponseSchema>;
