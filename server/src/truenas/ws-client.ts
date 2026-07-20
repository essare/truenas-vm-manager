type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export const TRUENAS_WS_TIMEOUT_MS = 15_000;

function explicitPortFromInput(input: string): string | null {
  const schemeEnd = input.indexOf("://");
  if (schemeEnd === -1) return null;
  const authority = input.slice(schemeEnd + 3).split(/[/?#]/)[0];
  const match = authority.match(/:(\d+)$/);
  return match ? match[1] : null;
}

export function hostToWsUrl(host: string): string {
  const input = host.includes("://") ? host : `https://${host}`;
  const u = new URL(input);
  const protocol = u.protocol === "http:" ? "ws:" : "wss:";
  const port = u.port || explicitPortFromInput(input);
  const hostPart = port ? `${u.hostname}:${port}` : u.hostname;
  return `${protocol}//${hostPart}/api/current`;
}

export class TrueNasClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;

  private constructor(
    private ws: WebSocket,
    private timeoutMs = TRUENAS_WS_TIMEOUT_MS,
  ) {
    ws.addEventListener("message", (ev) => this.onMessage(String(ev.data)));
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const p of this.pending.values()) {
        clearTimeout(p.timeout);
        p.reject(new Error("WebSocket closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(
    host: string,
    apiKey: string,
    timeoutMs = TRUENAS_WS_TIMEOUT_MS,
    username = "root",
  ): Promise<TrueNasClient> {
    const url = hostToWsUrl(host);
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("TrueNAS WebSocket handshake timed out"));
      }, timeoutMs);
      const finish = (callback: () => void) => {
        clearTimeout(timeout);
        callback();
      };
      ws.addEventListener("open", () => finish(resolve), { once: true });
      ws.addEventListener(
        "error",
        () => finish(() => reject(new Error(`Failed to connect to ${url}`))),
        { once: true },
      );
    });
    const client = new TrueNasClient(ws, timeoutMs);
    try {
      const login = await client.call<{ response_type: string }>(
        "auth.login_ex",
        [
          {
            mechanism: "API_KEY_PLAIN",
            username,
            api_key: apiKey,
          },
        ],
      );
      if (login.response_type !== "SUCCESS") {
        throw new Error(`TrueNAS auth failed: ${login.response_type}`);
      }
      return client;
    } catch (err) {
      client.close();
      throw err;
    }
  }

  call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Client closed"));
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("TrueNAS call timed out"));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timeout,
      });
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error("WebSocket send failed"));
      }
    });
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }

  private onMessage(raw: string): void {
    let msg: {
      id?: number;
      result?: unknown;
      error?: { message?: string | null; data?: { reason?: string; errname?: string } };
      method?: string;
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id === undefined) return; // notification
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timeout);
    if (msg.error) {
      const reason =
        msg.error.data?.reason ||
        msg.error.data?.errname ||
        msg.error.message ||
        "TrueNAS error";
      pending.reject(new Error(String(reason)));
      return;
    }
    pending.resolve(msg.result);
  }
}
