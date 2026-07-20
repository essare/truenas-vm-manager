import { createAppContext } from "./app-context";
import { getEnv } from "./env";
import { handleRequest } from "./router";

const env = getEnv();
const ctx = createAppContext(env);
const hostname = process.env.HOST?.trim() || "127.0.0.1";

const server = Bun.serve({
  hostname,
  port: env.port,
  async fetch(req) {
    return handleRequest(ctx, req);
  },
});

console.log(`API listening on http://${hostname}:${server.port}`);
