import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { decryptJson, encryptJson } from "./crypto";

export type TrueNasConfig = {
  host: string;
  apiKey: string;
  /** TrueNAS account that owns the API key (required by auth.login_ex). */
  username: string;
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
  const cfg = decryptJson<Partial<TrueNasConfig> & { host: string; apiKey: string }>(
    secret,
    blob,
  );
  return {
    host: cfg.host,
    apiKey: cfg.apiKey,
    username: cfg.username?.trim() || "root",
  };
}

export async function deleteTrueNasConfig(dataDir: string): Promise<void> {
  try {
    await unlink(encPath(dataDir));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
