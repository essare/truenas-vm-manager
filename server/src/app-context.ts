import { randomUUID } from "node:crypto";
import type { Env } from "./env";
import {
  loadTrueNasConfig,
  type TrueNasConfig,
} from "./truenas/config-store";
import { TrueNasClient, TRUENAS_WS_TIMEOUT_MS } from "./truenas/ws-client";

export type AppContext = {
  env: Env;
  sessionEpoch: string;
  unlockFailures: {
    count: number;
    blockedUntil: number;
  };
  /** Test seam for replacing the network client. */
  connectTrueNas?: (cfg: TrueNasConfig) => Promise<TrueNasClient>;
};

export function createAppContext(env: Env): AppContext {
  return {
    env,
    sessionEpoch: randomUUID(),
    unlockFailures: { count: 0, blockedUntil: 0 },
  };
}

export async function connectTrueNas(
  ctx: AppContext,
  cfg: TrueNasConfig,
): Promise<TrueNasClient> {
  return ctx.connectTrueNas
    ? ctx.connectTrueNas(cfg)
    : TrueNasClient.connect(
        cfg.host,
        cfg.apiKey,
        TRUENAS_WS_TIMEOUT_MS,
        cfg.username,
      );
}

export async function withClient<T>(
  ctx: AppContext,
  fn: (client: TrueNasClient) => Promise<T>,
): Promise<T> {
  const cfg = await loadTrueNasConfig(
    ctx.env.dataDir,
    ctx.env.sessionSecret,
  );
  if (!cfg) throw new Error("NOT_ONBOARDED");

  const client = await connectTrueNas(ctx, cfg);
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}
