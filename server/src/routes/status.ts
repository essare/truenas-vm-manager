import type { AppContext } from "../app-context";
import { parseSession } from "../auth/session";
import { json } from "../http";
import {
  hasTrueNasConfig,
  loadTrueNasConfig,
} from "../truenas/config-store";
import { isSetupComplete } from "../auth/app-password";

export async function statusRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  const setupComplete = await isSetupComplete(ctx.env.dataDir);
  const unlocked = Boolean(
    parseSession(
      req.headers.get("cookie"),
      ctx.env.sessionSecret,
      ctx.sessionEpoch,
    ),
  );
  const onboarded = await hasTrueNasConfig(ctx.env.dataDir);
  const result: {
    setupRequired: boolean;
    unlocked: boolean;
    onboarded: boolean;
    host?: string;
  } = {
    setupRequired: !setupComplete,
    unlocked,
    onboarded,
  };

  if (setupComplete && unlocked && onboarded) {
    const cfg = await loadTrueNasConfig(
      ctx.env.dataDir,
      ctx.env.sessionSecret,
    );
    if (cfg) result.host = cfg.host;
  }

  return json(result);
}
