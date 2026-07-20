import { mkdir, open } from "node:fs/promises";
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
  await mkdir(dataDir, { recursive: true });
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
  });
  try {
    const file = await open(appPath(dataDir), "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify({ passwordHash } satisfies AppFile));
    } finally {
      await file.close();
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Already set up");
    }
    throw err;
  }
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
