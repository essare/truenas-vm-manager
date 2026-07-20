import {
  connectTrueNas,
  type AppContext,
} from "../app-context";
import { errorJson, json, readJson } from "../http";
import {
  deleteTrueNasConfig,
  saveTrueNasConfig,
  type TrueNasConfig,
} from "../truenas/config-store";

function normalizeHost(host: string, isProd: boolean): string {
  const url = new URL(host.includes("://") ? host : `https://${host}`);
  if (url.username || url.password) {
    throw new Error("Invalid host URL");
  }
  if (url.protocol === "http:") {
    if (isProd) {
      throw new Error("HTTP_NOT_ALLOWED");
    }
  } else if (url.protocol !== "https:") {
    throw new Error("Invalid host URL");
  }
  return url.origin;
}

function connectFailureResponse(err: unknown): Response {
  const message =
    err instanceof Error && err.message.trim()
      ? err.message
      : "Could not connect to TrueNAS";

  if (/timed out/i.test(message)) {
    return errorJson(504, "TIMEOUT", message);
  }
  if (
    /auth failed|AUTH_ERR|EXPIRED|EINVAL|api key|invalid API key/i.test(
      message,
    )
  ) {
    return errorJson(401, "TRUENAS_AUTH_FAILED", message);
  }
  return errorJson(502, "TRUENAS_CONNECTION_FAILED", message);
}

export async function connectTrueNasRoute(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  if (req.method === "DELETE") {
    await deleteTrueNasConfig(ctx.env.dataDir);
    return json({ ok: true });
  }

  const body = await readJson<{
    host?: unknown;
    apiKey?: unknown;
  }>(req);
  if (
    typeof body.host !== "string" ||
    !body.host.trim() ||
    typeof body.apiKey !== "string" ||
    !body.apiKey
  ) {
    return errorJson(400, "INVALID_REQUEST", "Host and API key are required");
  }

  let cfg: TrueNasConfig;
  try {
    cfg = {
      host: normalizeHost(body.host.trim(), ctx.env.isProd),
      apiKey: body.apiKey,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "HTTP_NOT_ALLOWED") {
      return errorJson(
        400,
        "HTTPS_REQUIRED",
        "HTTPS is required in production; use an https:// TrueNAS URL",
      );
    }
    return errorJson(400, "INVALID_HOST", "Enter a valid TrueNAS host URL");
  }

  let client;
  try {
    client = await connectTrueNas(ctx, cfg);
  } catch (err) {
    return connectFailureResponse(err);
  }
  client.close();

  await saveTrueNasConfig(
    ctx.env.dataDir,
    ctx.env.sessionSecret,
    cfg,
  );
  return json({ host: cfg.host });
}
