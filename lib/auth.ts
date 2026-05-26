import { NextRequest } from "next/server";

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  if (querySecret === secret) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === secret) return true;

  return false;
}

export function verifyTestRun(request: NextRequest): boolean {
  if (verifyCronSecret(request)) return true;

  const publicSecret = process.env.NEXT_PUBLIC_CRON_SECRET;
  if (!publicSecret) return false;

  const bodySecret = request.headers.get("x-test-secret");
  if (bodySecret === publicSecret) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === publicSecret;
}
