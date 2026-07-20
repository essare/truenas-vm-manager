import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppContext } from "../src/app-context";
import type { Env } from "../src/env";
import { handleRequest } from "../src/router";
import type { TrueNasClient } from "../src/truenas/ws-client";

describe("VM routes", () => {
  let dataDir: string;
  let ctx: ReturnType<typeof createAppContext>;
  let cookie: string;
  let calls: Array<{ method: string; params?: unknown[] }>;
  let closeCount: number;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "tvm-"));
    const env: Env = {
      sessionSecret: "test-session-secret!!",
      port: 0,
      dataDir,
      isProd: false,
    };
    ctx = createAppContext(env);
    calls = [];
    closeCount = 0;
    ctx.connectTrueNas = async () =>
      ({
        async call<T>(method: string, params?: unknown[]) {
          calls.push({ method, params });
          if (method === "vm.query") {
            return [
              { id: 1, name: "router", vcpus: 2, memory: 4_294_967_296, autostart: true },
            ] as T;
          }
          if (method === "vm.status") return { state: "STOPPED" } as T;
          return undefined as T;
        },
        close() {
          closeCount += 1;
        },
      }) as unknown as TrueNasClient;

    await request("POST", "/api/setup", { password: "password1" });
    const unlock = await request("POST", "/api/unlock", { password: "password1" });
    cookie = unlock.headers.get("set-cookie")!.split(";")[0];
    await request(
      "POST",
      "/api/truenas/connect",
      { host: "https://nas.example.test", apiKey: "secret" },
      cookie,
    );
    calls = [];
    closeCount = 0;
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  function request(method: string, pathname: string, body?: unknown, authCookie?: string) {
    return handleRequest(
      ctx,
      new Request(`http://local${pathname}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(authCookie ? { cookie: authCookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }

  test("lists VMs and closes the TrueNAS client", async () => {
    const res = await request("GET", "/api/vms", undefined, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      vms: [
        {
          id: 1,
          name: "router",
          state: "STOPPED",
          vcpus: 2,
          memoryBytes: 4_294_967_296,
          autostart: true,
        },
      ],
    });
    expect(calls).toEqual([
      { method: "vm.query", params: [[], {}] },
      { method: "vm.status", params: [1] },
    ]);
    expect(closeCount).toBe(1);
  });

  test("dispatches all VM power actions", async () => {
    for (const action of ["start", "restart", "poweroff"]) {
      const res = await request("POST", `/api/vms/1/${action}`, undefined, cookie);
      expect(res.status).toBe(200);
    }
    expect(calls).toEqual([
      { method: "vm.start", params: [1, { overcommit: false }] },
      { method: "vm.restart", params: [1] },
      { method: "vm.poweroff", params: [1] },
    ]);
    expect(closeCount).toBe(3);
  });

  test("rejects invalid VM ids and missing onboarding", async () => {
    let res = await request("POST", "/api/vms/not-a-number/start", undefined, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "INVALID_VM_ID", message: "VM id must be a positive integer" },
    });

    await request("DELETE", "/api/truenas/connect", undefined, cookie);
    res = await request("GET", "/api/vms", undefined, cookie);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "NOT_ONBOARDED", message: "TrueNAS connection required" },
    });
  });

  test("maps TrueNAS errors to the shared error shape", async () => {
    ctx.connectTrueNas = async () =>
      ({
        async call() {
          throw new Error("ENOMEM: not enough free memory");
        },
        close() {
          closeCount += 1;
        },
      }) as unknown as TrueNasClient;

    const res = await request("POST", "/api/vms/1/start", undefined, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "INSUFFICIENT_MEMORY",
        message: "Not enough free memory to start this VM",
      },
    });
    expect(closeCount).toBe(1);
  });
});
