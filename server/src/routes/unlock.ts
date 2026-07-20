import type { AppContext } from "../app-context";
import {
  isSetupComplete,
  verifyAppPassword,
} from "../auth/app-password";
import { createSessionCookie } from "../auth/session";
import { errorJson, json, readJson } from "../http";

export async function unlockRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  if (!(await isSetupComplete(ctx.env.dataDir))) {
    return errorJson(400, "SETUP_REQUIRED", "Create an app password first");
  }

  const body = await readJson<{ password?: unknown }>(req);
  if (
    typeof body.password !== "string" ||
    !(await verifyAppPassword(ctx.env.dataDir, body.password))
  ) {
    return errorJson(401, "INVALID_PASSWORD", "Incorrect password");
  }

  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": createSessionCookie(
          ctx.env.sessionSecret,
          ctx.env.isProd,
        ),
      },
    },
  );
}
