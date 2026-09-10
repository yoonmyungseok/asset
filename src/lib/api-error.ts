import { NextResponse } from "next/server";

export function apiError(
  status: number,
  detail: string | Record<string, unknown> | unknown[],
) {
  return NextResponse.json({ detail }, { status });
}
