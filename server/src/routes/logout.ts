import type { AppContext } from "../app-context";
import { clearSessionCookie } from "../auth/session";
import { json } from "../http";

export function logoutRoute(ctx: AppContext): Response {
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearSessionCookie(ctx.env.isProd),
      },
    },
  );
}
