import { describe, expect, test, afterEach } from "bun:test";
import { hostToWsUrl, TrueNasClient } from "../src/truenas/ws-client";

describe("hostToWsUrl", () => {
  test("https → wss /api/current", () => {
    expect(hostToWsUrl("https://nas.example:443")).toBe(
      "wss://nas.example/api/current",
    );
    expect(hostToWsUrl("https://nas.example:8443")).toBe(
      "wss://nas.example:8443/api/current",
    );
  });
  test("http → ws", () => {
    expect(hostToWsUrl("http://192.168.1.5")).toBe(
      "ws://192.168.1.5/api/current",
    );
  });
});

describe("TrueNasClient", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop(true);
    server = undefined;
  });

  test("login + call", async () => {
    server = Bun.serve<undefined>({
      port: 0,
      fetch(req, srv) {
        if (srv.upgrade(req, {})) return undefined;
        return new Response("fail", { status: 500 });
      },
      websocket: {
        message(ws, message) {
          const msg = JSON.parse(String(message)) as {
            id: number;
            method: string;
            params: unknown[];
          };
          if (msg.method === "auth.login_ex") {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result: { response_type: "SUCCESS" },
              }),
            );
            return;
          }
          if (msg.method === "system.info") {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result: { version: "TrueNAS-25.10" },
              }),
            );
          }
        },
      },
    });

    const host = `http://127.0.0.1:${server.port}`;
    const client = await TrueNasClient.connect(host, "test-key");
    const info = await client.call<{ version: string }>("system.info", []);
    expect(info.version).toBe("TrueNAS-25.10");
    client.close();
  });
});
