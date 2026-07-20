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
