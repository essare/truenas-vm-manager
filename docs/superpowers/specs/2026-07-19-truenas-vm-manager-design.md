# TrueNAS VM Manager — Design Spec

**Date:** 2026-07-19  
**Status:** Approved for planning  
**TrueNAS API reference:** local WebSocket docs (v25.10.4) in this workspace

## Goal

A modern web UI to manage TrueNAS virtual machines: list VMs, start, restart, and power off, with clear power-state feedback. Users complete an onboarding flow for TrueNAS host + API key. Access to the app itself is gated by an app password.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Architecture | Thin Bun proxy + Vite React frontend (same pattern family as `~/Developer/OpenSource/drime-s3`) |
| UI stack | React, Tailwind, shadcn, TanStack Query, React Router |
| TrueNAS transport | Server-side WebSocket JSON-RPC; browser never talks to TrueNAS directly |
| App access | Single shared app password (v1) |
| Credential storage | Encrypted server-side TrueNAS config on disk; httpOnly session cookie after unlock |
| Status freshness | Poll every ~3–5 seconds; refetch after actions |
| VM card fields | Name, state, vCPUs, memory, autostart |
| Actions | Start, restart, power off (no soft stop, create, edit, console in v1) |

## Architecture

```
truenas-vm-manager/
  server/     # Bun.serve — auth, session, TrueNAS WebSocket client, REST API
  web/        # Vite + React + Tailwind + shadcn
  data/       # runtime: app password hash, encrypted TrueNAS config (gitignored)
  docs/       # specs + optional relocated API reference
```

**Request flow**

1. Browser calls only the Bun server (same origin in production; Vite proxy / CORS in development).
2. Bun validates the app session cookie on protected routes.
3. Bun maintains (or opens on demand) a WebSocket to the TrueNAS host, authenticates with `auth.login_ex` using `mechanism: "API_KEY_PLAIN"`, then invokes VM methods.
4. UI polls `GET /api/vms` and posts power actions to dedicated endpoints.

**Out of scope (v1)**

- Create / update / delete VMs
- Soft shutdown (`vm.stop`), suspend / resume
- Console, VNC, display URI
- Live TrueNAS event subscriptions
- Multi-user accounts / per-user ACLs
- Managing multiple TrueNAS hosts at once

## Auth, sessions & persistence

### App password

- First run: `POST /api/setup` creates an app password; store a **bcrypt or argon2 hash** in `data/app.json` (never plaintext).
- Subsequent visits: unlock via `POST /api/unlock`; on success set an **httpOnly, Secure-when-HTTPS, SameSite** signed session cookie (e.g. `app_session`).
- `POST /api/logout` clears the session.
- All `/api/*` routes except setup, unlock, and a minimal public status endpoint require a valid session.

### TrueNAS credentials

- After unlock, if no TrueNAS config exists, UI forces `/onboarding`.
- User submits host URL + API key; server validates by connecting and calling `auth.login_ex`.
- On success, persist **encrypted** host + API key in `data/truenas.enc` using a key derived from `SESSION_SECRET` (env). API key is never returned to the client in plaintext.
- Server restart: user must unlock again; TrueNAS config remains and does not require re-onboarding.
- Settings: reconnect (replace host/key), disconnect (delete encrypted config), change app password.

### Session secret

- `SESSION_SECRET` is required in production (env or `.env`). Used for cookie signing and encrypting `truenas.enc`.

## REST API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/status` | optional | `{ setupRequired, unlocked, onboarded, host? }` — never includes API key |
| `POST` | `/api/setup` | public (only if unset) | Create app password |
| `POST` | `/api/unlock` | public | Verify password → set session cookie |
| `POST` | `/api/logout` | session | Clear session |
| `POST` | `/api/truenas/connect` | session | Validate + save host/key |
| `DELETE` | `/api/truenas/connect` | session | Remove TrueNAS config |
| `GET` | `/api/vms` | session + onboarded | List VM card DTOs |
| `POST` | `/api/vms/:id/start` | session + onboarded | `vm.start` |
| `POST` | `/api/vms/:id/restart` | session + onboarded | `vm.restart` |
| `POST` | `/api/vms/:id/poweroff` | session + onboarded | `vm.poweroff` |
| `POST` | `/api/password` | session | Change app password |

JSON error shape: `{ error: { code, message } }` with appropriate HTTP status (401, 403, 400, 502, 504).

## TrueNAS integration

**Client module (server-only):** connect WebSocket, login, `call(method, params)`, reconnect with backoff, disconnect cleanup.

**Auth:** `auth.login_ex` with `API_KEY_PLAIN` (preferred over deprecated `auth.login_with_api_key`).

**Methods used**

| UI need | API |
|---------|-----|
| List + card fields | `vm.query` |
| Power state | `vm.status` for each VM after query (authoritative `RUNNING` / `STOPPED` / `SUSPENDED`) |
| Start | `vm.start` `[id, { overcommit: false }]` |
| Restart | `vm.restart` `[id]` — TrueNAS **job**; server waits with timeout (~30–60s) |
| Power off | `vm.poweroff` `[id]` |

**Card DTO**

```ts
type VmCard = {
  id: number;
  name: string;
  state: "RUNNING" | "STOPPED" | "SUSPENDED" | string;
  vcpus: number;
  memoryBytes: number; // from TrueNAS memory field; UI humanizes
  autostart: boolean;
};
```

Display labels: Running, Powered off, Suspended (fallback: raw state).

**Roles required on the API key:** at least `VM_READ` and `VM_WRITE`.

## UI

### Routes

| Path | Purpose |
|------|---------|
| `/setup` | First-run app password |
| `/unlock` | Unlock |
| `/onboarding` | TrueNAS host + API key |
| `/` | VM dashboard |
| `/settings` | Reconnect, disconnect, change password, log out |

**Guards:** setup required → `/setup`; locked → `/unlock`; unlocked without TrueNAS → `/onboarding`; else dashboard.

### Dashboard

- Responsive card grid.
- Each card: name, state badge, vCPUs, memory (e.g. `4 GiB`), autostart.
- Actions by state:
  - `STOPPED` → Start
  - `RUNNING` → Restart, Power off
  - `SUSPENDED` → Power off only (no start/restart in v1)
- Confirm dialog before restart and power off.
- Per-card busy state; disable actions while in flight; toast on success/failure.
- TanStack Query: poll `GET /api/vms` every 3–5s; invalidate/refetch after mutations.
- Empty list: dedicated empty state.

### Visual direction

Fast, modern ops UI: clear hierarchy, light theme by default, Tailwind + shadcn components. Optional dark mode is post-v1.

## Errors & edge cases

- Wrong app password / weak password: inline validation.
- Onboarding failures (DNS, TLS, auth): human-readable message; never leak API key or internal stack traces to the UI.
- `vm.start` `ENOMEM`: message like “Not enough free memory to start this VM”.
- TrueNAS unreachable mid-session: `502`/`503` → toast + keep last known list or show reconnect banner; settings to fix credentials.
- Session expired: `401` → redirect to unlock.
- Concurrent actions on one VM: ignore/disable until the first completes.
- Empty VM list: empty state, not a blank grid.

## Testing

- **Server:** unit tests for password hashing, session cookie guards, encryption of `truenas.enc`, DTO mapping; TrueNAS client tested with a mock WebSocket.
- **Web:** component tests for state badges and action availability; route-guard smoke tests.
- **Manual:** unlock → onboard → list → start / restart / power off against a real TrueNAS when available.

## Non-functional

- Run locally via Bun (`server`) + Vite (`web`); production: Bun serves API and static `web/dist` (or reverse proxy).
- Secrets only in env / `data/` (gitignored).
- No TrueNAS credentials in browser storage.

## Success criteria

1. User can set an app password, unlock, and connect a TrueNAS host with an API key.
2. Dashboard lists VMs with name, state, vCPUs, memory, and autostart.
3. User can start, restart, and power off VMs with confirmations and clear feedback.
4. Status stays reasonably fresh via polling without a full page reload.
5. API key never appears in frontend storage or API responses.
