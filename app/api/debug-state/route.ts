import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { listNewsKeys } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await listNewsKeys();
  const state: Record<string, unknown> = {};

  for (const { key, value } of entries) {
    if (typeof value === "string") {
      try {
        state[key] = JSON.parse(value);
      } catch {
        state[key] = value;
      }
    } else {
      state[key] = value;
    }
  }

  return NextResponse.json({
    prefix: "news:",
    keyCount: entries.length,
    keys: Object.keys(state).sort(),
    state,
  });
}
