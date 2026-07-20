import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { decryptJson, encryptJson } from "./crypto";

export type TrueNasConfig = {
  host: string;
  apiKey: string;
  /** Optional; retained for older encrypted configs. Auth uses API key only. */
  username?: string;
};

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
  const cfg = decryptJson<{ host: string; apiKey: string; username?: string }>(
    secret,
    blob,
  );
  return {
    host: cfg.host,
    apiKey: cfg.apiKey,
    ...(cfg.username ? { username: cfg.username } : {}),
  };
}

export async function deleteTrueNasConfig(dataDir: string): Promise<void> {
  try {
    await unlink(encPath(dataDir));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
