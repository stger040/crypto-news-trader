import { NextRequest } from "next/server";

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  if (request.nextUrl.searchParams.get("secret") === secret) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;

  return false;
}

/** Server-to-server only — never accept public env vars. */
export function verifyTestRun(request: NextRequest): boolean {
  return verifyCronSecret(request);
}
