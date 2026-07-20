import type { AppContext } from "../app-context";
import {
  isSetupComplete,
  verifyAppPassword,
} from "../auth/app-password";
import { createSessionCookie } from "../auth/session";
import { errorJson, json, readJson } from "../http";

const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MS = 15 * 60 * 1000;

export async function unlockRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  if (!(await isSetupComplete(ctx.env.dataDir))) {
    return errorJson(400, "SETUP_REQUIRED", "Create an app password first");
  }

  const now = Date.now();
  if (ctx.unlockFailures.blockedUntil > now) {
    return errorJson(
      429,
      "TOO_MANY_ATTEMPTS",
      "Too many unlock attempts; try again later",
    );
  }
  if (ctx.unlockFailures.blockedUntil !== 0) {
    ctx.unlockFailures = { count: 0, blockedUntil: 0 };
  }

  const body = await readJson<{ password?: unknown }>(req);
  if (
    typeof body.password !== "string" ||
    !(await verifyAppPassword(ctx.env.dataDir, body.password))
  ) {
    ctx.unlockFailures.count += 1;
    if (ctx.unlockFailures.count >= MAX_FAILED_ATTEMPTS) {
      ctx.unlockFailures.blockedUntil = now + COOLDOWN_MS;
    }
    return errorJson(401, "INVALID_PASSWORD", "Incorrect password");
  }

  ctx.unlockFailures = { count: 0, blockedUntil: 0 };
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": createSessionCookie(
          ctx.env.sessionSecret,
          ctx.sessionEpoch,
          ctx.env.isProd,
        ),
      },
    },
  );
}
