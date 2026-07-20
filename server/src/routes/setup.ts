import type { AppContext } from "../app-context";
import { createAppPassword } from "../auth/app-password";
import { errorJson, json, readJson } from "../http";

export async function setupRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  const body = await readJson<{ password?: unknown }>(req);
  if (typeof body.password !== "string" || body.password.length < 8) {
    return errorJson(
      400,
      "INVALID_PASSWORD",
      "Password must be at least 8 characters",
    );
  }

  try {
    await createAppPassword(ctx.env.dataDir, body.password);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Already set up") {
      return errorJson(409, "ALREADY_SETUP", "App password is already configured");
    }
    throw err;
  }
}
