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
