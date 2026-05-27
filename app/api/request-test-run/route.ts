import { NextResponse } from "next/server";
import { runCronCycle } from "@/lib/cronRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** UI trigger — no client secret; runs test cycle server-side only. */
export async function POST() {
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

export async function GET() {
  return POST();
}
