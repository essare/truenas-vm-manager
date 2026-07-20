import type { AppContext } from "../app-context";
import { changeAppPassword } from "../auth/app-password";
import { errorJson, json, readJson } from "../http";

export async function passwordRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  const body = await readJson<{
    currentPassword?: unknown;
    newPassword?: unknown;
  }>(req);
  if (
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return errorJson(400, "INVALID_REQUEST", "Current and new passwords are required");
  }
  if (body.newPassword.length < 8) {
    return errorJson(
      400,
      "INVALID_PASSWORD",
      "Password must be at least 8 characters",
    );
  }

  const changed = await changeAppPassword(
    ctx.env.dataDir,
    body.currentPassword,
    body.newPassword,
  );
  return changed
    ? json({ ok: true })
    : errorJson(403, "INVALID_PASSWORD", "Current password is incorrect");
}
