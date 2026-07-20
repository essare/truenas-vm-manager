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
