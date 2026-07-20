export const COOKIE_NAME = "app_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export function createSessionCookie(secret: string, isProd: boolean): string {
  const payload = Buffer.from(
    JSON.stringify({ unlocked: true, exp: Date.now() + MAX_AGE_SEC * 1000 }),
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
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { unlocked?: boolean; exp?: number };
    if (!data.unlocked || !data.exp || data.exp < Date.now()) return null;
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
