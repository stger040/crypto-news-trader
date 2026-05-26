import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { runCronCycle } from "@/lib/cronRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCronCycle();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
