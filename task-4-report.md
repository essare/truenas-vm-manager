# Task 4 Report

## Fix: preserve explicit ports in hostToWsUrl

**Issue:** `URL.toString()` strips default ports (443/80), so `hostToWsUrl("https://nas.example:443")` returned `wss://nas.example/api/current` instead of the brief's `wss://nas.example:443/api/current`.

**Fix:** Parse with `URL` for protocol/hostname; when `u.port` is empty, detect an explicit `:port` in the input authority via regex and include it in the output.

**Verification:** `bun test tests/ws-client.test.ts` — 3 pass; `bun run typecheck` — clean.
