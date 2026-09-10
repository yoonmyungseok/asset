import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import { apiError } from "@/lib/api-error";
import { serializeDecimal } from "@/lib/decimal";
import { RateLimitError } from "@/lib/external/market-data";
import { TossApiError, TossRateLimitError } from "@/lib/external/toss-invest";
import { ServiceError } from "@/lib/service-error";

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Decimal) {
    return serializeDecimal(value);
  }
  return value;
}

export function jsonOk(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(JSON.parse(JSON.stringify(data, jsonReplacer)), init);
}

export function parseQueryInt(value: string | null, fallback?: number): number | undefined {
  if (value == null || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseQueryBool(value: string | null): boolean | null | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

export function parseRequiredQueryInt(value: string | null, name: string): number {
  const parsed = parseQueryInt(value);
  if (parsed == null) {
    throw new ServiceError(422, `${name} is required`);
  }
  return parsed;
}

export function parseJsonBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ServiceError(422, error.issues.map((issue) => issue.message).join(", "));
    }
    throw error;
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return apiError(error.statusCode, error.message);
  }
  if (error instanceof RateLimitError) {
    return apiError(429, error.message);
  }
  if (error instanceof TossRateLimitError) {
    return apiError(429, error.message);
  }
  if (error instanceof TossApiError) {
    return apiError(400, error.message);
  }
  if (error instanceof ZodError) {
    return apiError(422, error.issues.map((issue) => issue.message).join(", "));
  }
  console.error(error);
  return apiError(500, "Internal server error");
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseOptionalDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError(422, `Invalid date: ${value}`);
  }
  return parsed;
}
