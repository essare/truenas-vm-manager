import { describe, expect, test } from "bun:test";
import {
  COOKIE_NAME,
  clearSessionCookie,
  createSessionCookie,
  parseSession,
} from "../src/auth/session";

const secret = "test-session-secret!!";

describe("session", () => {
  test("round-trip", () => {
    const setCookie = createSessionCookie(secret, false);
    expect(setCookie.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    const header = `${COOKIE_NAME}=${value}`;
    expect(parseSession(header, secret)).toEqual({ unlocked: true });
  });

  test("rejects tampering", () => {
    const setCookie = createSessionCookie(secret, false);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(parseSession(`${COOKIE_NAME}=${value}x`, secret)).toBeNull();
  });

  test("clear cookie", () => {
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
  });

  test("createSessionCookie sets HttpOnly, SameSite=Lax, and Secure when prod", () => {
    const devCookie = createSessionCookie(secret, false);
    expect(devCookie).toContain("HttpOnly");
    expect(devCookie).toContain("SameSite=Lax");
    expect(devCookie).not.toContain("Secure");

    const prodCookie = createSessionCookie(secret, true);
    expect(prodCookie).toContain("Secure");
  });

  test("rejects wrong secret", () => {
    const setCookie = createSessionCookie(secret, false);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(parseSession(`${COOKIE_NAME}=${value}`, "other-secret")).toBeNull();
  });

  test("rejects expired session", () => {
    const payload = Buffer.from(
      JSON.stringify({ unlocked: true, exp: Date.now() - 1000 }),
      "utf8",
    ).toString("base64url");
    const sig = new Bun.CryptoHasher("sha256", secret)
      .update(payload)
      .digest("base64url");
    expect(parseSession(`${COOKIE_NAME}=${payload}.${sig}`, secret)).toBeNull();
  });
});
