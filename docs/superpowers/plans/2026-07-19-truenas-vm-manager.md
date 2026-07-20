# TrueNAS VM Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun proxy + Vite/React UI that unlocks with an app password, onboards a TrueNAS host/API key, and lists/start/restart/poweroff VMs with polled status.

**Architecture:** Browser talks only to `Bun.serve`. Server stores an app-password hash and encrypted TrueNAS credentials on disk, issues an httpOnly session cookie after unlock, and proxies VM operations over a server-side JSON-RPC 2.0 WebSocket to TrueNAS (`/api/current`). Frontend is Vite + React + Tailwind + shadcn with TanStack Query polling.

**Tech Stack:** Bun, TypeScript, Vite, React 19, React Router, TanStack Query, Tailwind CSS 4, shadcn (new-york), Zod, Lucide. Spec: `docs/superpowers/specs/2026-07-19-truenas-vm-manager-design.md`. API reference: local TrueNAS v25.10.4 docs (`_sources/`, especially `jsonrpc.rst.txt`, `api_methods_vm.*.rst.txt`, `api_methods_auth.login_ex.rst.txt`, `jobs.rst.txt`).

## Global Constraints

- Browser never stores or receives the TrueNAS API key in plaintext.
- Auth to TrueNAS uses `auth.login_ex` with `mechanism: "API_KEY_PLAIN"` (not deprecated `auth.login_with_api_key`).
- WebSocket endpoint: `{ws|wss}://{host}/api/current` derived from the user-supplied host URL.
- JSON-RPC 2.0 request shape: `{ jsonrpc: "2.0", id, method, params }`.
- VM card DTO fields only: `id`, `name`, `state`, `vcpus`, `memoryBytes`, `autostart`.
- Actions v1: start, restart, poweroff only. Suspended VMs: poweroff only.
- Error JSON: `{ error: { code: string, message: string } }`.
- Secrets live in `data/` (gitignored) and `.env` (`SESSION_SECRET` required).
- Follow TDD: failing test → implement → pass → commit per task.
- Prefer small focused files; mirror `drime-s3` Bun.serve style (no Express/Hono required).

---

## File Structure

```
truenas-vm-manager/
  package.json                 # workspace root scripts
  .env.example
  server/
    package.json
    tsconfig.json
    src/
      index.ts                 # entry: load env, start Bun.serve
      env.ts                   # SESSION_SECRET, PORT, DATA_DIR
      http.ts                  # json(), errorJson(), readJson()
      router.ts                # pathname dispatch
      auth/
        app-password.ts        # hash/verify + data/app.json
        session.ts             # signed cookie create/parse/clear
      truenas/
        crypto.ts              # encrypt/decrypt truenas.enc
        config-store.ts        # load/save/delete credentials
        ws-client.ts           # WebSocket JSON-RPC client
        vm-service.ts          # listVms, start, restart, poweroff
      routes/
        status.ts
        setup.ts
        unlock.ts
        logout.ts
        password.ts
        truenas-connect.ts
        vms.ts
    tests/
      app-password.test.ts
      session.test.ts
      crypto.test.ts
      ws-client.test.ts
      vm-service.test.ts
      routes-auth.test.ts
      routes-vms.test.ts
  web/
    package.json
    vite.config.ts
    components.json
    index.html
    src/
      main.tsx
      App.tsx
      index.css
      lib/utils.ts
      lib/api.ts               # fetch wrappers
      lib/types.ts
      hooks/use-app-status.ts
      hooks/use-vms.ts
      components/
        route-guards.tsx
        vm-card.tsx
        confirm-dialog.tsx
        ui/...                 # shadcn
      pages/
        setup.tsx
        unlock.tsx
        onboarding.tsx
        dashboard.tsx
        settings.tsx
    tests/
      vm-card.test.tsx
      route-guards.test.tsx
  data/                        # runtime only, gitignored
```

---

### Task 1: Server scaffold, env, HTTP helpers

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/env.ts`
- Create: `server/src/http.ts`
- Create: `server/tests/http.test.ts`
- Modify: `.gitignore` (ensure `data/`, `.env`, `node_modules` covered)

**Interfaces:**
- Produces: `getEnv(): { sessionSecret: string; port: number; dataDir: string; isProd: boolean }`
- Produces: `json(data, init?)`, `errorJson(status, code, message)`, `readJson<T>(req)`

- [ ] **Step 1: Write the failing test**

```ts
// server/tests/http.test.ts
import { describe, expect, test } from "bun:test";
import { errorJson, json } from "../src/http";

describe("http helpers", () => {
  test("json sets application/json", async () => {
    const res = json({ ok: true });
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  test("errorJson shape", async () => {
    const res = errorJson(400, "BAD_REQUEST", "Nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "Nope" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test tests/http.test.ts`

Expected: FAIL (module not found / cannot find http)

- [ ] **Step 3: Write minimal implementation**

Root `package.json`:

```json
{
  "name": "truenas-vm-manager",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "bun run --filter server dev & bun run --filter web dev",
    "dev:server": "bun run --filter server dev",
    "dev:web": "bun run --filter web dev",
    "test": "bun run --filter server test && bun run --filter web test",
    "typecheck": "bun run --filter server typecheck && bun run --filter web typecheck"
  }
}
```

`.env.example`:

```
SESSION_SECRET=change-me-to-a-long-random-string
PORT=8787
DATA_DIR=./data
```

`server/package.json`:

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --hot run src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.9.0"
  }
}
```

`server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["bun-types"],
    "skipLibCheck": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

`server/src/env.ts`:

```ts
import path from "node:path";

export type Env = {
  sessionSecret: string;
  port: number;
  dataDir: string;
  isProd: boolean;
};

export function getEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const sessionSecret = env.SESSION_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error("SESSION_SECRET must be set (min 16 chars)");
  }
  return {
    sessionSecret,
    port: Number(env.PORT ?? "8787"),
    dataDir: path.resolve(env.DATA_DIR ?? "./data"),
    isProd: env.NODE_ENV === "production",
  };
}
```

`server/src/http.ts`:

```ts
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
): Response {
  return json({ error: { code, message } }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
```

Stub `server/src/index.ts` for now:

```ts
console.log("server entry — wired in later task");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/ayoub/Developer/Frontend/truenas-vm-manager/server && bun install && SESSION_SECRET=test-secret-16chars bun test tests/http.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json .env.example .gitignore server/
git commit -m "chore: scaffold Bun server workspace and HTTP helpers"
```

---

### Task 2: App password store + signed session cookies

**Files:**
- Create: `server/src/auth/app-password.ts`
- Create: `server/src/auth/session.ts`
- Create: `server/tests/app-password.test.ts`
- Create: `server/tests/session.test.ts`

**Interfaces:**
- Consumes: `getEnv().dataDir`, `getEnv().sessionSecret`, `getEnv().isProd`
- Produces:
  - `isSetupComplete(dataDir): Promise<boolean>`
  - `createAppPassword(dataDir, password): Promise<void>`
  - `verifyAppPassword(dataDir, password): Promise<boolean>`
  - `changeAppPassword(dataDir, current, next): Promise<boolean>`
  - `COOKIE_NAME = "app_session"`
  - `createSessionCookie(secret, isProd): string` (Set-Cookie value)
  - `clearSessionCookie(isProd): string`
  - `parseSession(cookieHeader, secret): { unlocked: true } | null`

- [ ] **Step 1: Write the failing tests**

```ts
// server/tests/app-password.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  changeAppPassword,
  createAppPassword,
  isSetupComplete,
  verifyAppPassword,
} from "../src/auth/app-password";

describe("app-password", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "tvm-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("setup then verify", async () => {
    expect(await isSetupComplete(dataDir)).toBe(false);
    await createAppPassword(dataDir, "correct-horse");
    expect(await isSetupComplete(dataDir)).toBe(true);
    expect(await verifyAppPassword(dataDir, "correct-horse")).toBe(true);
    expect(await verifyAppPassword(dataDir, "wrong")).toBe(false);
  });

  test("change password", async () => {
    await createAppPassword(dataDir, "old-pass-word");
    expect(await changeAppPassword(dataDir, "old-pass-word", "new-pass-word")).toBe(true);
    expect(await verifyAppPassword(dataDir, "new-pass-word")).toBe(true);
  });
});
```

```ts
// server/tests/session.test.ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && bun test tests/app-password.test.ts tests/session.test.ts`

Expected: FAIL (modules missing)

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/auth/app-password.ts
import { mkdir } from "node:fs/promises";
import path from "node:path";

type AppFile = { passwordHash: string };

function appPath(dataDir: string) {
  return path.join(dataDir, "app.json");
}

export async function isSetupComplete(dataDir: string): Promise<boolean> {
  return Bun.file(appPath(dataDir)).exists();
}

export async function createAppPassword(
  dataDir: string,
  password: string,
): Promise<void> {
  if (password.length < 8) throw new Error("Password too short");
  if (await isSetupComplete(dataDir)) throw new Error("Already set up");
  await mkdir(dataDir, { recursive: true });
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
  });
  await Bun.write(appPath(dataDir), JSON.stringify({ passwordHash } satisfies AppFile));
}

export async function verifyAppPassword(
  dataDir: string,
  password: string,
): Promise<boolean> {
  const file = Bun.file(appPath(dataDir));
  if (!(await file.exists())) return false;
  const data = (await file.json()) as AppFile;
  return Bun.password.verify(password, data.passwordHash);
}

export async function changeAppPassword(
  dataDir: string,
  current: string,
  next: string,
): Promise<boolean> {
  if (next.length < 8) return false;
  if (!(await verifyAppPassword(dataDir, current))) return false;
  const passwordHash = await Bun.password.hash(next, { algorithm: "argon2id" });
  await Bun.write(appPath(dataDir), JSON.stringify({ passwordHash } satisfies AppFile));
  return true;
}
```

```ts
// server/src/auth/session.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && bun test tests/app-password.test.ts tests/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/auth server/tests/app-password.test.ts server/tests/session.test.ts
git commit -m "feat(server): app password hashing and signed session cookies"
```

---

### Task 3: Encrypted TrueNAS config store

**Files:**
- Create: `server/src/truenas/crypto.ts`
- Create: `server/src/truenas/config-store.ts`
- Create: `server/tests/crypto.test.ts`

**Interfaces:**
- Produces: `encryptJson(secret, obj): string`, `decryptJson<T>(secret, blob): T`
- Produces: `TrueNasConfig = { host: string; apiKey: string }`
- Produces: `hasTrueNasConfig(dataDir)`, `saveTrueNasConfig(dataDir, secret, cfg)`, `loadTrueNasConfig(dataDir, secret)`, `deleteTrueNasConfig(dataDir)`

- [ ] **Step 1: Write the failing test**

```ts
// server/tests/crypto.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decryptJson, encryptJson } from "../src/truenas/crypto";
import {
  deleteTrueNasConfig,
  hasTrueNasConfig,
  loadTrueNasConfig,
  saveTrueNasConfig,
} from "../src/truenas/config-store";

const secret = "session-secret-for-tests";

describe("truenas crypto + store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "tvm-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("encrypt round-trip", () => {
    const blob = encryptJson(secret, { host: "https://nas.local", apiKey: "k" });
    expect(decryptJson<{ host: string; apiKey: string }>(secret, blob)).toEqual({
      host: "https://nas.local",
      apiKey: "k",
    });
  });

  test("store persists encrypted file", async () => {
    expect(await hasTrueNasConfig(dataDir)).toBe(false);
    await saveTrueNasConfig(dataDir, secret, {
      host: "https://nas.local",
      apiKey: "secret-key",
    });
    expect(await hasTrueNasConfig(dataDir)).toBe(true);
    expect(await loadTrueNasConfig(dataDir, secret)).toEqual({
      host: "https://nas.local",
      apiKey: "secret-key",
    });
    await deleteTrueNasConfig(dataDir);
    expect(await hasTrueNasConfig(dataDir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test tests/crypto.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/truenas/crypto.ts
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** Returns base64url(iv || ciphertext || tag) */
export function encryptJson(secret: string, obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64url");
}

export function decryptJson<T>(secret: string, blob: string): T {
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}
```

```ts
// server/src/truenas/config-store.ts
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { decryptJson, encryptJson } from "./crypto";

export type TrueNasConfig = { host: string; apiKey: string };

function encPath(dataDir: string) {
  return path.join(dataDir, "truenas.enc");
}

export async function hasTrueNasConfig(dataDir: string): Promise<boolean> {
  return Bun.file(encPath(dataDir)).exists();
}

export async function saveTrueNasConfig(
  dataDir: string,
  secret: string,
  cfg: TrueNasConfig,
): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await Bun.write(encPath(dataDir), encryptJson(secret, cfg));
}

export async function loadTrueNasConfig(
  dataDir: string,
  secret: string,
): Promise<TrueNasConfig | null> {
  const file = Bun.file(encPath(dataDir));
  if (!(await file.exists())) return null;
  const blob = await file.text();
  return decryptJson<TrueNasConfig>(secret, blob);
}

export async function deleteTrueNasConfig(dataDir: string): Promise<void> {
  try {
    await unlink(encPath(dataDir));
  } catch {
    // ignore missing
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && bun test tests/crypto.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/truenas/crypto.ts server/src/truenas/config-store.ts server/tests/crypto.test.ts
git commit -m "feat(server): encrypt TrueNAS host and API key at rest"
```

---

### Task 4: TrueNAS WebSocket JSON-RPC client

**Files:**
- Create: `server/src/truenas/ws-client.ts`
- Create: `server/tests/ws-client.test.ts`

**Interfaces:**
- Produces: `hostToWsUrl(host: string): string`
- Produces: `class TrueNasClient { static connect(host, apiKey): Promise<TrueNasClient>; call<T>(method, params?): Promise<T>; close(): void }`
- Login uses `auth.login_ex` with `{ mechanism: "API_KEY_PLAIN", api_key }` and requires `response_type === "SUCCESS"`.

- [ ] **Step 1: Write the failing test**

Use a local Bun mock WebSocket server in the test file:

```ts
// server/tests/ws-client.test.ts
import { describe, expect, test, afterEach } from "bun:test";
import { hostToWsUrl, TrueNasClient } from "../src/truenas/ws-client";

describe("hostToWsUrl", () => {
  test("https → wss /api/current", () => {
    expect(hostToWsUrl("https://nas.example:443")).toBe(
      "wss://nas.example:443/api/current",
    );
  });
  test("http → ws", () => {
    expect(hostToWsUrl("http://192.168.1.5")).toBe(
      "ws://192.168.1.5/api/current",
    );
  });
});

describe("TrueNasClient", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop(true);
    server = undefined;
  });

  test("login + call", async () => {
    server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        if (srv.upgrade(req)) return undefined;
        return new Response("fail", { status: 500 });
      },
      websocket: {
        message(ws, message) {
          const msg = JSON.parse(String(message)) as {
            id: number;
            method: string;
            params: unknown[];
          };
          if (msg.method === "auth.login_ex") {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result: { response_type: "SUCCESS" },
              }),
            );
            return;
          }
          if (msg.method === "system.info") {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result: { version: "TrueNAS-25.10" },
              }),
            );
          }
        },
      },
    });

    const host = `http://127.0.0.1:${server.port}`;
    const client = await TrueNasClient.connect(host, "test-key");
    const info = await client.call<{ version: string }>("system.info", []);
    expect(info.version).toBe("TrueNAS-25.10");
    client.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test tests/ws-client.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/truenas/ws-client.ts
type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export function hostToWsUrl(host: string): string {
  const u = new URL(host.includes("://") ? host : `https://${host}`);
  u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
  u.pathname = "/api/current";
  u.search = "";
  u.hash = "";
  return u.toString();
}

export class TrueNasClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;

  private constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => this.onMessage(String(ev.data)));
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const p of this.pending.values()) {
        p.reject(new Error("WebSocket closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(host: string, apiKey: string): Promise<TrueNasClient> {
    const url = hostToWsUrl(host);
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener(
        "error",
        () => reject(new Error(`Failed to connect to ${url}`)),
        { once: true },
      );
    });
    const client = new TrueNasClient(ws);
    const login = await client.call<{ response_type: string }>("auth.login_ex", [
      { mechanism: "API_KEY_PLAIN", api_key: apiKey },
    ]);
    if (login.response_type !== "SUCCESS") {
      client.close();
      throw new Error(`TrueNAS auth failed: ${login.response_type}`);
    }
    return client;
  }

  call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Client closed"));
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }

  private onMessage(raw: string): void {
    let msg: {
      id?: number;
      result?: unknown;
      error?: { message?: string | null; data?: { reason?: string; errname?: string } };
      method?: string;
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id === undefined) return; // notification
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    if (msg.error) {
      const reason =
        msg.error.data?.reason ||
        msg.error.data?.errname ||
        msg.error.message ||
        "TrueNAS error";
      pending.reject(new Error(String(reason)));
      return;
    }
    pending.resolve(msg.result);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && bun test tests/ws-client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/truenas/ws-client.ts server/tests/ws-client.test.ts
git commit -m "feat(server): TrueNAS JSON-RPC WebSocket client with API key login"
```

---

### Task 5: VM service (list + actions)

**Files:**
- Create: `server/src/truenas/vm-service.ts`
- Create: `server/tests/vm-service.test.ts`

**Interfaces:**
- Consumes: `TrueNasClient`
- Produces:
  - `type VmCard = { id: number; name: string; state: string; vcpus: number; memoryBytes: number; autostart: boolean }`
  - `listVms(client): Promise<VmCard[]>`
  - `startVm(client, id): Promise<void>`
  - `restartVm(client, id, timeoutMs?): Promise<void>` — calls `vm.restart`, then `core.job_wait` if result is a job id number
  - `poweroffVm(client, id): Promise<void>`
  - `mapTrueNasError(err: Error): { code: string; message: string; status: number }`

- [ ] **Step 1: Write the failing test**

```ts
// server/tests/vm-service.test.ts
import { describe, expect, test } from "bun:test";
import { listVms, mapTrueNasError, type VmCallClient } from "../src/truenas/vm-service";

function mockClient(handlers: Record<string, (params: unknown[]) => unknown>): VmCallClient {
  return {
    call: async (method, params = []) => {
      const h = handlers[method];
      if (!h) throw new Error(`unexpected ${method}`);
      return h(params);
    },
  };
}

describe("listVms", () => {
  test("maps query + status", async () => {
    const client = mockClient({
      "vm.query": () => [
        {
          id: 1,
          name: "media",
          vcpus: 4,
          memory: 8 * 1024 * 1024 * 1024,
          autostart: true,
        },
      ],
      "vm.status": () => ({ state: "RUNNING", pid: 1, domain_state: "running" }),
    });
    expect(await listVms(client)).toEqual([
      {
        id: 1,
        name: "media",
        state: "RUNNING",
        vcpus: 4,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        autostart: true,
      },
    ]);
  });
});

describe("mapTrueNasError", () => {
  test("ENOMEM", () => {
    const mapped = mapTrueNasError(new Error("ENOMEM: not enough free memory"));
    expect(mapped.status).toBe(400);
    expect(mapped.message).toContain("memory");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test tests/vm-service.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/truenas/vm-service.ts
export type VmCard = {
  id: number;
  name: string;
  state: string;
  vcpus: number;
  memoryBytes: number;
  autostart: boolean;
};

export type VmCallClient = {
  call: <T>(method: string, params?: unknown[]) => Promise<T>;
};

type VmQueryRow = {
  id: number;
  name: string;
  vcpus?: number;
  memory?: number;
  autostart?: boolean;
};

type VmStatus = { state: string };

export async function listVms(client: VmCallClient): Promise<VmCard[]> {
  const rows = await client.call<VmQueryRow[]>("vm.query", [[], {}]);
  const cards: VmCard[] = [];
  for (const row of rows) {
    const status = await client.call<VmStatus>("vm.status", [row.id]);
    cards.push({
      id: row.id,
      name: row.name,
      state: status.state,
      vcpus: row.vcpus ?? 0,
      memoryBytes: row.memory ?? 0,
      autostart: Boolean(row.autostart),
    });
  }
  return cards;
}

export async function startVm(client: VmCallClient, id: number): Promise<void> {
  await client.call("vm.start", [id, { overcommit: false }]);
}

export async function poweroffVm(client: VmCallClient, id: number): Promise<void> {
  await client.call("vm.poweroff", [id]);
}

export async function restartVm(
  client: VmCallClient,
  id: number,
  timeoutMs = 60_000,
): Promise<void> {
  const result = await client.call<unknown>("vm.restart", [id]);
  if (typeof result === "number") {
    await Promise.race([
      client.call("core.job_wait", [result]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Restart timed out")), timeoutMs),
      ),
    ]);
  }
}

export function mapTrueNasError(err: Error): {
  code: string;
  message: string;
  status: number;
} {
  const msg = err.message || "TrueNAS request failed";
  if (/ENOMEM|not enough free memory/i.test(msg)) {
    return {
      code: "INSUFFICIENT_MEMORY",
      message: "Not enough free memory to start this VM",
      status: 400,
    };
  }
  if (/timed out/i.test(msg)) {
    return { code: "TIMEOUT", message: msg, status: 504 };
  }
  return { code: "TRUENAS_ERROR", message: msg, status: 502 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && bun test tests/vm-service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/truenas/vm-service.ts server/tests/vm-service.test.ts
git commit -m "feat(server): VM list and power action service"
```

---

### Task 6: HTTP routes + Bun.serve entry

**Files:**
- Create: `server/src/routes/status.ts`
- Create: `server/src/routes/setup.ts`
- Create: `server/src/routes/unlock.ts`
- Create: `server/src/routes/logout.ts`
- Create: `server/src/routes/password.ts`
- Create: `server/src/routes/truenas-connect.ts`
- Create: `server/src/routes/vms.ts`
- Create: `server/src/router.ts`
- Create: `server/src/app-context.ts`
- Modify: `server/src/index.ts`
- Create: `server/tests/routes-auth.test.ts`
- Create: `server/tests/routes-vms.test.ts`

**Interfaces:**
- Produces: `createAppContext(env)`, `handleRequest(ctx, req): Promise<Response>`
- Route table matches design spec exactly.
- Dev CORS: allow `http://localhost:5173` with credentials.
- `withClient(ctx, fn)` opens `TrueNasClient` from stored config, runs `fn`, closes in `finally`.

- [ ] **Step 1: Write failing route tests**

```ts
// server/tests/routes-auth.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppContext } from "../src/app-context";
import { handleRequest } from "../src/router";
import type { Env } from "../src/env";

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

describe("auth routes", () => {
  let dataDir: string;
  let ctx: ReturnType<typeof createAppContext>;

  beforeEach(async () => {
    ({ ctx, dataDir } = await makeCtx());
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("setup → unlock → status", async () => {
    let res = await handleRequest(ctx, new Request("http://local/api/status"));
    expect(await res.json()).toMatchObject({ setupRequired: true, unlocked: false });

    res = await handleRequest(
      ctx,
      new Request("http://local/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "password1" }),
      }),
    );
    expect(res.status).toBe(200);

    res = await handleRequest(
      ctx,
      new Request("http://local/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "password1" }),
      }),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("app_session=");

    res = await handleRequest(
      ctx,
      new Request("http://local/api/status", { headers: { cookie: cookie!.split(";")[0] } }),
    );
    expect(await res.json()).toMatchObject({
      setupRequired: false,
      unlocked: true,
      onboarded: false,
    });
  });
});
```

For VM routes, inject a fake client factory on context in tests (see Step 3).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test tests/routes-auth.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement routes + router + index**

Implement each route handler returning `Response` via `json` / `errorJson`. Require session via `parseSession` except for `GET /api/status`, `POST /api/setup`, `POST /api/unlock`.

`POST /api/truenas/connect` body `{ host, apiKey }`: normalize host URL, `TrueNasClient.connect`, on success `saveTrueNasConfig`, return `{ host }` only.

`GET /api/vms` and power routes: load config, connect, call vm-service, map errors.

`app-context.ts` should expose:

```ts
export type AppContext = {
  env: Env;
  /** test seam */
  connectTrueNas?: (cfg: TrueNasConfig) => Promise<TrueNasClient>;
};
```

Default connect uses `TrueNasClient.connect`.

Wire `index.ts`:

```ts
import { getEnv } from "./env";
import { createAppContext } from "./app-context";
import { handleRequest } from "./router";

const env = getEnv();
const ctx = createAppContext(env);

Bun.serve({
  port: env.port,
  async fetch(req) {
    return handleRequest(ctx, req);
  },
});

console.log(`API listening on http://127.0.0.1:${env.port}`);
```

Add CORS helper for dev origin `http://localhost:5173` on API responses (including `Access-Control-Allow-Credentials: true` and OPTIONS preflight).

Also add a VM routes test that stubs `ctx.connectTrueNas` to a mock client returning one VM and asserting `GET /api/vms` + `POST /api/vms/1/start`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && bun test`

Expected: all server tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src server/tests
git commit -m "feat(server): REST API routes for auth, TrueNAS connect, and VMs"
```

---

### Task 7: Web app scaffold (Vite + React + Tailwind + shadcn)

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/index.html`, `web/components.json`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`, `web/src/lib/utils.ts`, `web/src/lib/api.ts`, `web/src/lib/types.ts`
- Create: shadcn UI primitives needed later: `button`, `input`, `label`, `card`, `badge`, `dialog`, `toast`/`sonner`

**Interfaces:**
- Produces: `api.getStatus()`, `api.setup(password)`, `api.unlock(password)`, `api.logout()`, `api.connectTrueNas(host, apiKey)`, `api.disconnectTrueNas()`, `api.listVms()`, `api.startVm(id)`, `api.restartVm(id)`, `api.poweroffVm(id)`, `api.changePassword(current, next)`
- Vite proxy: `/api` → `http://127.0.0.1:8787`

- [ ] **Step 1: Scaffold with Bun**

```bash
cd /Users/ayoub/Developer/Frontend/truenas-vm-manager
bunx create-vite@latest web --template react-ts
cd web
bun add react-router-dom @tanstack/react-query zod sonner lucide-react class-variance-authority clsx tailwind-merge
bun add -d @tailwindcss/vite tailwindcss vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Configure Tailwind v4 via `@tailwindcss/vite` in `vite.config.ts`, path alias `@` → `src`, proxy `/api` to port 8787 with `changeOrigin` and cookie support.

Initialize shadcn (new-york, neutral) matching `drime-s3/web/components.json`, then add components:

```bash
cd web && bunx shadcn@latest add button input label card badge dialog sonner
```

- [ ] **Step 2: Add api client + smoke test**

```ts
// web/src/lib/types.ts
export type AppStatus = {
  setupRequired: boolean;
  unlocked: boolean;
  onboarded: boolean;
  host?: string;
};

export type VmCard = {
  id: number;
  name: string;
  state: string;
  vcpus: number;
  memoryBytes: number;
  autostart: boolean;
};
```

```ts
// web/src/lib/api.ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message ?? res.statusText;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  getStatus: () => request<import("./types").AppStatus>("/api/status"),
  setup: (password: string) =>
    request("/api/setup", { method: "POST", body: JSON.stringify({ password }) }),
  unlock: (password: string) =>
    request("/api/unlock", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/api/logout", { method: "POST", body: "{}" }),
  connectTrueNas: (host: string, apiKey: string) =>
    request("/api/truenas/connect", {
      method: "POST",
      body: JSON.stringify({ host, apiKey }),
    }),
  disconnectTrueNas: () =>
    request("/api/truenas/connect", { method: "DELETE" }),
  listVms: () => request<{ vms: import("./types").VmCard[] }>("/api/vms"),
  startVm: (id: number) =>
    request(`/api/vms/${id}/start`, { method: "POST", body: "{}" }),
  restartVm: (id: number) =>
    request(`/api/vms/${id}/restart`, { method: "POST", body: "{}" }),
  poweroffVm: (id: number) =>
    request(`/api/vms/${id}/poweroff`, { method: "POST", body: "{}" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/api/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
```

Write a tiny vitest that mocks `fetch` and asserts `api.getStatus` calls `/api/status` with credentials.

- [ ] **Step 3: Run web tests**

Run: `cd web && bun test`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web package.json
git commit -m "chore: scaffold Vite React web app with Tailwind and API client"
```

---

### Task 8: Auth + onboarding pages and route guards

**Files:**
- Create: `web/src/pages/setup.tsx`, `unlock.tsx`, `onboarding.tsx`
- Create: `web/src/hooks/use-app-status.ts`
- Create: `web/src/components/route-guards.tsx`
- Modify: `web/src/App.tsx`
- Create: `web/tests/route-guards.test.tsx`

**Interfaces:**
- Consumes: `api.*`, `AppStatus`
- Guard behavior from spec: setup → unlock → onboarding → dashboard

- [ ] **Step 1: Write failing guard tests**

Test a pure helper `resolveRoute(status, path): string | null` that returns a redirect target or null if OK — keep routing logic testable without full router.

```ts
// web/src/components/route-guards.tsx (export helper)
export function resolveRoute(
  status: AppStatus,
  path: string,
): string | null {
  if (status.setupRequired && path !== "/setup") return "/setup";
  if (!status.setupRequired && path === "/setup") return "/unlock";
  if (!status.setupRequired && !status.unlocked && path !== "/unlock") return "/unlock";
  if (status.unlocked && !status.onboarded && path !== "/onboarding" && path !== "/settings")
    return "/onboarding";
  if (status.unlocked && status.onboarded && (path === "/unlock" || path === "/onboarding" || path === "/setup"))
    return "/";
  return null;
}
```

- [ ] **Step 2: Run test to verify it fails / then implement pages**

Pages:
- Setup: password + confirm (≥8 chars), submit `api.setup`, navigate unlock
- Unlock: password, `api.unlock`, invalidate status
- Onboarding: host URL + API key, `api.connectTrueNas`, navigate `/`

Wire React Query `useAppStatus` with `queryKey: ["status"]`.

- [ ] **Step 3: Manual check**

Run server with `SESSION_SECRET=... bun run src/index.ts` and `bun run dev` in web; walk setup → unlock → onboarding form (connect can fail against fake host — error toast OK).

- [ ] **Step 4: Commit**

```bash
git add web/src web/tests
git commit -m "feat(web): setup, unlock, onboarding flows and route guards"
```

---

### Task 9: Dashboard VM cards + polling + actions

**Files:**
- Create: `web/src/pages/dashboard.tsx`
- Create: `web/src/components/vm-card.tsx`
- Create: `web/src/components/confirm-dialog.tsx`
- Create: `web/src/hooks/use-vms.ts`
- Create: `web/tests/vm-card.test.tsx`

**Interfaces:**
- `useVms`: `useQuery` with `refetchInterval: 4000`, `queryKey: ["vms"]`
- Mutations invalidate `["vms"]`
- Card actions per state from spec

- [ ] **Step 1: Write failing VmCard tests**

```tsx
// web/tests/vm-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { VmCardView } from "../src/components/vm-card";

const base = {
  id: 1,
  name: "media",
  vcpus: 4,
  memoryBytes: 4 * 1024 ** 3,
  autostart: true,
};

describe("VmCardView", () => {
  test("stopped shows Start", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "STOPPED" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /power off/i })).toBeNull();
  });

  test("running shows Restart and Power off", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "RUNNING" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /power off/i })).toBeInTheDocument();
  });

  test("suspended shows Power off only", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "SUSPENDED" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
    expect(screen.getByRole("button", { name: /power off/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement card + dashboard**

- Humanize memory: GiB/MiB
- State badge labels: Running / Powered off / Suspended
- Confirm dialog before restart/poweroff
- Empty state when `vms.length === 0`
- Toasts via sonner
- Disable buttons when `busy`

- [ ] **Step 3: Run tests**

Run: `cd web && bun test`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src web/tests
git commit -m "feat(web): VM dashboard cards with polling and power actions"
```

---

### Task 10: Settings, static prod serve, README

**Files:**
- Create: `web/src/pages/settings.tsx`
- Modify: `server/src/router.ts` (serve `web/dist` in production for non-API paths)
- Create: `README.md`
- Modify: root `package.json` scripts (`build`, `start`)

**Interfaces:**
- Settings: show current host, reconnect form, disconnect, change password, logout
- Production: `bun run build` builds web; `bun run start` serves API + static

- [ ] **Step 1: Implement settings page** wired to existing API methods

- [ ] **Step 2: Static file serving**

In router, if method GET and path not starting with `/api`, try `web/dist` + SPA fallback to `index.html` when `web/dist` exists.

- [ ] **Step 3: README**

Document:
- Copy `.env.example` → `.env`
- `bun install`
- `bun run dev:server` + `bun run dev:web`
- Create TrueNAS API key with `VM_READ` + `VM_WRITE`
- Production build/start

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/ayoub/Developer/Frontend/truenas-vm-manager && bun test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md package.json server/src/router.ts web/src/pages/settings.tsx
git commit -m "feat: settings page, production static serving, and README"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Bun proxy + Vite/React | 1, 7 |
| App password + argon2 hash in `data/app.json` | 2, 6 |
| Signed httpOnly session cookie | 2, 6 |
| Encrypted `truenas.enc` via `SESSION_SECRET` | 3 |
| `auth.login_ex` API_KEY_PLAIN | 4 |
| REST routes table | 6 |
| `vm.query` + `vm.status` list DTO | 5 |
| start / restart / poweroff | 5, 6, 9 |
| Restart job wait + timeout | 5 |
| Setup / unlock / onboarding / dashboard / settings | 8, 9, 10 |
| Poll 3–5s | 9 (`refetchInterval: 4000`) |
| Confirm restart/poweroff | 9 |
| Suspended → poweroff only | 9 |
| ENOMEM mapping | 5 |
| API key never in browser storage/responses | 6, 7 (`host` only in status) |
| Tests server + web | 1–9 |
| README / prod serve | 10 |

**Placeholder scan:** none intentionally left.  
**Type consistency:** `VmCard` fields aligned across `vm-service`, API JSON, and `web/src/lib/types.ts`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-truenas-vm-manager.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session using executing-plans, with batch checkpoints  

Which approach?
