import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppContext } from "../src/app-context";
import type { Env } from "../src/env";
import { handleRequest } from "../src/router";
import type { TrueNasClient } from "../src/truenas/ws-client";

async function makeCtx() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tvm-"));
  const env: Env = {
    sessionSecret: "test-session-secret!!",
    port: 0,
    dataDir,
    isProd: false,
  };
  return { ctx: createAppContext(env), dataDir };
}

async function post(
  ctx: ReturnType<typeof createAppContext>,
  pathname: string,
  body?: unknown,
  cookie?: string,
) {
  return handleRequest(
    ctx,
    new Request(`http://local${pathname}`, {
      method: "POST",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function setupAndUnlock(ctx: ReturnType<typeof createAppContext>) {
  expect((await post(ctx, "/api/setup", { password: "password1" })).status).toBe(200);
  const res = await post(ctx, "/api/unlock", { password: "password1" });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("auth routes", () => {
  let dataDir: string;
  let ctx: ReturnType<typeof createAppContext>;

  beforeEach(async () => {
    ({ ctx, dataDir } = await makeCtx());
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("setup, unlock, and status expose only safe state", async () => {
    let res = await handleRequest(ctx, new Request("http://local/api/status"));
    expect(await res.json()).toEqual({
      setupRequired: true,
      unlocked: false,
      onboarded: false,
    });

    expect((await post(ctx, "/api/setup", { password: "short" })).status).toBe(400);
    expect((await post(ctx, "/api/setup", { password: "password1" })).status).toBe(200);
    expect((await post(ctx, "/api/unlock", { password: "wrong-password" })).status).toBe(401);

    res = await post(ctx, "/api/unlock", { password: "password1" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("app_session=");

    res = await handleRequest(
      ctx,
      new Request("http://local/api/status", {
        headers: { cookie: cookie!.split(";")[0] },
      }),
    );
    expect(await res.json()).toEqual({
      setupRequired: false,
      unlocked: true,
      onboarded: false,
    });
  });

  test("protected routes reject requests without a session", async () => {
    const res = await post(ctx, "/api/logout");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Unlock required" },
    });
  });

  test("connect normalizes and saves host without returning API key", async () => {
    const cookie = await setupAndUnlock(ctx);
    let connectedConfig: { host: string; apiKey: string } | undefined;
    let closed = false;
    ctx.connectTrueNas = async (cfg) => {
      connectedConfig = cfg;
      return { close: () => { closed = true; } } as unknown as TrueNasClient;
    };

    let res = await post(
      ctx,
      "/api/truenas/connect",
      { host: "nas.example.test/", apiKey: "top-secret" },
      cookie,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ host: "https://nas.example.test" });
    expect(connectedConfig).toEqual({
      host: "https://nas.example.test",
      apiKey: "top-secret",
    });
    expect(closed).toBe(true);

    res = await handleRequest(
      ctx,
      new Request("http://local/api/status", { headers: { cookie } }),
    );
    const text = await res.text();
    expect(text).not.toContain("top-secret");
    expect(JSON.parse(text)).toEqual({
      setupRequired: false,
      unlocked: true,
      onboarded: true,
      host: "https://nas.example.test",
    });

    res = await handleRequest(ctx, new Request("http://local/api/status"));
    expect(await res.json()).toEqual({
      setupRequired: false,
      unlocked: false,
      onboarded: true,
    });
  });

  test("sessions are invalid after the process context restarts", async () => {
    const cookie = await setupAndUnlock(ctx);
    const restartedCtx = createAppContext(ctx.env);
    const res = await post(restartedCtx, "/api/logout", undefined, cookie);

    expect(res.status).toBe(401);
  });

  test("unlock rate limits after five failed attempts", async () => {
    expect((await post(ctx, "/api/setup", { password: "password1" })).status).toBe(200);
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(
        (await post(ctx, "/api/unlock", { password: "wrong-password" })).status,
      ).toBe(401);
    }

    const res = await post(ctx, "/api/unlock", { password: "password1" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many unlock attempts; try again later",
      },
    });
  });

  test("password change, logout, and disconnect work for an unlocked session", async () => {
    const cookie = await setupAndUnlock(ctx);

    let res = await post(
      ctx,
      "/api/password",
      { currentPassword: "password1", newPassword: "password2" },
      cookie,
    );
    expect(res.status).toBe(200);

    res = await post(ctx, "/api/logout", undefined, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");

    expect((await post(ctx, "/api/unlock", { password: "password1" })).status).toBe(401);
    expect((await post(ctx, "/api/unlock", { password: "password2" })).status).toBe(200);

    res = await handleRequest(
      ctx,
      new Request("http://local/api/truenas/connect", {
        method: "DELETE",
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(200);
  });

  test("connect accepts http hosts outside production", async () => {
    const cookie = await setupAndUnlock(ctx);
    ctx.connectTrueNas = async () =>
      ({ close: () => {} }) as unknown as TrueNasClient;

    const res = await post(
      ctx,
      "/api/truenas/connect",
      {
        host: "http://truenas.home.arpa:8080",
        apiKey: "top-secret",
      },
      cookie,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      host: "http://truenas.home.arpa:8080",
    });
  });

  test("connect rejects http hosts in production", async () => {
    const prodCtx = createAppContext({ ...ctx.env, isProd: true });
    const cookie = await setupAndUnlock(prodCtx);

    const res = await post(
      prodCtx,
      "/api/truenas/connect",
      { host: "http://truenas.home.arpa:8080", apiKey: "top-secret" },
      cookie,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "HTTPS_REQUIRED",
        message:
          "HTTPS is required in production; use an https:// TrueNAS URL",
      },
    });
  });

  test("development CORS supports credentialed preflight", async () => {
    const res = await handleRequest(
      ctx,
      new Request("http://local/api/status", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});
