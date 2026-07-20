import type { AppContext } from "./app-context";
import { parseSession } from "./auth/session";
import { errorJson } from "./http";
import { logoutRoute } from "./routes/logout";
import { passwordRoute } from "./routes/password";
import { setupRoute } from "./routes/setup";
import { statusRoute } from "./routes/status";
import { connectTrueNasRoute } from "./routes/truenas-connect";
import { unlockRoute } from "./routes/unlock";
import { listVmsRoute, vmPowerRoute } from "./routes/vms";

const DEV_ORIGIN = "http://localhost:5173";
const PUBLIC_ROUTES = new Set([
  "GET /api/status",
  "POST /api/setup",
  "POST /api/unlock",
]);
const WEB_DIST = new URL("../../web/dist/", import.meta.url);

async function staticResponse(url: URL): Promise<Response | null> {
  const indexFile = Bun.file(new URL("index.html", WEB_DIST));
  if (!(await indexFile.exists())) {
    return null;
  }

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const hasTraversal =
    relativePath.includes("\\") ||
    relativePath.split("/").some((part) => part === "..");
  const requestedFile =
    relativePath && !hasTraversal
      ? Bun.file(new URL(relativePath, WEB_DIST))
      : indexFile;
  const file = (await requestedFile.exists()) ? requestedFile : indexFile;

  return new Response(file);
}

function withCors(ctx: AppContext, req: Request, res: Response): Response {
  if (ctx.env.isProd || req.headers.get("origin") !== DEV_ORIGIN) return res;
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", DEV_ORIGIN);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "Origin");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function routeRequest(ctx: AppContext, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = `${req.method} ${url.pathname}`;

  if (req.method === "GET" && !url.pathname.startsWith("/api")) {
    const response = await staticResponse(url);
    if (response) return response;
  }

  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
    });
  }

  if (
    !PUBLIC_ROUTES.has(key) &&
    !parseSession(
      req.headers.get("cookie"),
      ctx.env.sessionSecret,
      ctx.sessionEpoch,
    )
  ) {
    return errorJson(401, "UNAUTHORIZED", "Unlock required");
  }

  if (key === "GET /api/status") return statusRoute(ctx, req);
  if (key === "POST /api/setup") return setupRoute(ctx, req);
  if (key === "POST /api/unlock") return unlockRoute(ctx, req);
  if (key === "POST /api/logout") return logoutRoute(ctx);
  if (key === "POST /api/password") return passwordRoute(ctx, req);
  if (
    key === "POST /api/truenas/connect" ||
    key === "DELETE /api/truenas/connect"
  ) {
    return connectTrueNasRoute(ctx, req);
  }
  if (key === "GET /api/vms") return listVmsRoute(ctx);

  const powerMatch = url.pathname.match(
    /^\/api\/vms\/([^/]+)\/(start|restart|poweroff)$/,
  );
  if (req.method === "POST" && powerMatch) {
    return vmPowerRoute(ctx, powerMatch[1], powerMatch[2]);
  }

  return errorJson(404, "NOT_FOUND", "Route not found");
}

export async function handleRequest(
  ctx: AppContext,
  req: Request,
): Promise<Response> {
  let response: Response;
  try {
    response = await routeRequest(ctx, req);
  } catch (err) {
    response =
      err instanceof SyntaxError
        ? errorJson(400, "INVALID_JSON", "Request body must be valid JSON")
        : errorJson(500, "INTERNAL_ERROR", "Internal server error");
  }
  return withCors(ctx, req, response);
}
