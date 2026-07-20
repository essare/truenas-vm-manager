import { describe, expect, test } from "bun:test";
import {
  COOKIE_NAME,
  clearSessionCookie,
  createSessionCookie,
  parseSession,
} from "../src/auth/session";

const secret = "test-session-secret!!";
const epoch = "process-epoch";

describe("session", () => {
  test("round-trip", () => {
    const setCookie = createSessionCookie(secret, epoch, false);
    expect(setCookie.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    const header = `${COOKIE_NAME}=${value}`;
    expect(parseSession(header, secret, epoch)).toEqual({ unlocked: true });
  });

  test("rejects tampering", () => {
    const setCookie = createSessionCookie(secret, epoch, false);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(parseSession(`${COOKIE_NAME}=${value}x`, secret, epoch)).toBeNull();
  });

  test("rejects a session from a previous process epoch", () => {
    const setCookie = createSessionCookie(secret, "previous-epoch", false);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(parseSession(`${COOKIE_NAME}=${value}`, secret, epoch)).toBeNull();
  });

  test("clear cookie", () => {
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
  });

  test("createSessionCookie sets HttpOnly, SameSite=Lax, and Secure when prod", () => {
    const devCookie = createSessionCookie(secret, epoch, false);
    expect(devCookie).toContain("HttpOnly");
    expect(devCookie).toContain("SameSite=Lax");
    expect(devCookie).not.toContain("Secure");

    const prodCookie = createSessionCookie(secret, epoch, true);
    expect(prodCookie).toContain("Secure");
  });

  test("rejects wrong secret", () => {
    const setCookie = createSessionCookie(secret, epoch, false);
    const value = setCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(
      parseSession(`${COOKIE_NAME}=${value}`, "other-secret", epoch),
    ).toBeNull();
  });

  test("rejects expired session", () => {
    const payload = Buffer.from(
      JSON.stringify({ unlocked: true, exp: Date.now() - 1000, epoch }),
      "utf8",
    ).toString("base64url");
    const sig = new Bun.CryptoHasher("sha256", secret)
      .update(payload)
      .digest("base64url");
    expect(
      parseSession(`${COOKIE_NAME}=${payload}.${sig}`, secret, epoch),
    ).toBeNull();
  });
});
