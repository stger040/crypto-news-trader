import { NextRequest, NextResponse } from "next/server";
import { verifyTestRun } from "@/lib/auth";
import { runCronCycle } from "@/lib/cronRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyTestRun(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCronCycle(true);
  return NextResponse.json(
    { ...result, testRun: true },
    { status: result.ok ? 200 : 500 }
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
