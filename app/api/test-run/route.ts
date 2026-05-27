import { NextRequest, NextResponse } from "next/server";
import { verifyTestRun } from "@/lib/auth";
import { runCronCycle } from "@/lib/cronRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyTestRun(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCronCycle({
    testRun: true,
    forceSignal: true,
  });

  return NextResponse.json(
    {
      ...result,
      testRun: true,
      note: "Bypassed time filters; min position $50; simulated=true",
    },
    { status: result.ok ? 200 : 500 }
  );
}
