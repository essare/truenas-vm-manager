type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export function hostToWsUrl(host: string): string {
  const u = new URL(host.includes("://") ? host : `https://${host}`);
  u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
  u.pathname = "/api/current";
  u.search = "";
  u.hash = "";
  return u.toString();
}

export class TrueNasClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;

  private constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => this.onMessage(String(ev.data)));
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const p of this.pending.values()) {
        p.reject(new Error("WebSocket closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(host: string, apiKey: string): Promise<TrueNasClient> {
    const url = hostToWsUrl(host);
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener(
        "error",
        () => reject(new Error(`Failed to connect to ${url}`)),
        { once: true },
      );
    });
    const client = new TrueNasClient(ws);
    try {
      const login = await client.call<{ response_type: string }>(
        "auth.login_ex",
        [{ mechanism: "API_KEY_PLAIN", api_key: apiKey }],
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
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      this.ws.send(JSON.stringify(payload));
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
