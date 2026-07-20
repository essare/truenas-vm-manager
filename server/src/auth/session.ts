import { timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "app_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export function createSessionCookie(
  secret: string,
  epoch: string,
  isProd: boolean,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      unlocked: true,
      exp: Date.now() + MAX_AGE_SEC * 1000,
      epoch,
    }),
    "utf8",
  ).toString("base64url");
  const sig = new Bun.CryptoHasher("sha256", secret)
    .update(payload)
    .digest("base64url");
  const value = `${payload}.${sig}`;
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SEC}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function parseSession(
  cookieHeader: string | null,
  secret: string,
  epoch: string,
): { unlocked: true } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = new Bun.CryptoHasher("sha256", secret)
    .update(payload)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { unlocked?: boolean; exp?: number; epoch?: string };
    if (
      !data.unlocked ||
      !data.exp ||
      data.exp < Date.now() ||
      data.epoch !== epoch
    ) {
      return null;
    }
    return { unlocked: true };
  } catch {
    return null;
  }
}

export function clearSessionCookie(isProd: boolean): string {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
