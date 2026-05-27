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

export function verifyTestRun(request: NextRequest): boolean {
  if (verifyCronSecret(request)) return true;

  const publicSecret = process.env.NEXT_PUBLIC_CRON_SECRET;
  if (!publicSecret) return false;

  return (
    request.headers.get("x-test-secret") === publicSecret ||
    request.nextUrl.searchParams.get("secret") === publicSecret
  );
}
