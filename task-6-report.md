# Task 6 Report

## Fix: atomic exclusive app.json publication

**Issue:** `createAppPassword` wrote directly to `app.json` with `O_EXCL`; a crash mid-write could leave an empty/partial file that `isSetupComplete` treats as done, blocking setup forever.

**Fix:** Write the hash JSON to a unique temp file in `dataDir`, then publish via hard `link(temp, app.json)` (fails with `EEXIST` if destination exists). Temp is always unlinked in `finally`. `EEXIST` on link → `Already set up`.

**Test:** Added `createAppPassword leaves only app.json in dataDir` to verify temp cleanup.

**Verification:** `cd server && bun test && bun run typecheck` — 33 pass, clean.
