import { createAppContext } from "./app-context";
import { getEnv } from "./env";
import { handleRequest } from "./router";

const env = getEnv();
const ctx = createAppContext(env);

Bun.serve({
  port: env.port,
  async fetch(req) {
    return handleRequest(ctx, req);
  },
});

console.log(`API listening on http://127.0.0.1:${env.port}`);
