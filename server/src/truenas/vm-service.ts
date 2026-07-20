export type VmCard = {
  id: number;
  name: string;
  state: string;
  vcpus: number;
  memoryBytes: number;
  autostart: boolean;
  /** Best-effort guest OS hint from TrueNAS metadata. */
  guestOs: "windows" | "linux" | "unknown";
};

export type VmCallClient = {
  call: <T>(method: string, params?: unknown[]) => Promise<T>;
};

type VmQueryRow = {
  id: number;
  name: string;
  description?: string;
  vcpus?: number;
  memory?: number;
  autostart?: boolean;
  hyperv_enlightenments?: boolean;
};

type VmStatus = { state: string };

export function inferGuestOs(row: {
  name: string;
  description?: string;
  hyperv_enlightenments?: boolean;
}): VmCard["guestOs"] {
  if (row.hyperv_enlightenments) return "windows";
  const text = `${row.name} ${row.description ?? ""}`.toLowerCase();
  if (/\b(windows|win(10|11|server)?|microsoft)\b/.test(text)) return "windows";
  if (
    /\b(linux|ubuntu|debian|fedora|centos|rhel|rocky|alma|arch|suse|alpine|nixos|freebsd)\b/.test(
      text,
    )
  ) {
    return "linux";
  }
  return "unknown";
}

export async function listVms(client: VmCallClient): Promise<VmCard[]> {
  const rows = await client.call<VmQueryRow[]>("vm.query", [[], {}]);
  const cards: VmCard[] = [];
  for (const row of rows) {
    const status = await client.call<VmStatus>("vm.status", [row.id]);
    cards.push({
      id: row.id,
      name: row.name,
      state: status.state,
      vcpus: row.vcpus ?? 0,
      memoryBytes: row.memory ?? 0,
      autostart: Boolean(row.autostart),
      guestOs: inferGuestOs(row),
    });
  }
  return cards;
}

export async function startVm(client: VmCallClient, id: number): Promise<void> {
  await client.call("vm.start", [id, { overcommit: false }]);
}

export async function poweroffVm(client: VmCallClient, id: number): Promise<void> {
  await client.call("vm.poweroff", [id]);
}

export async function restartVm(
  client: VmCallClient,
  id: number,
  timeoutMs = 60_000,
): Promise<void> {
  const result = await client.call<unknown>("vm.restart", [id]);
  if (typeof result === "number") {
    await Promise.race([
      client.call("core.job_wait", [result]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Restart timed out")), timeoutMs),
      ),
    ]);
  }
}

export function mapTrueNasError(err: Error): {
  code: string;
  message: string;
  status: number;
} {
  const msg = err.message || "TrueNAS request failed";
  if (/ENOMEM|not enough free memory/i.test(msg)) {
    return {
      code: "INSUFFICIENT_MEMORY",
      message: "Not enough free memory to start this VM",
      status: 400,
    };
  }
  if (/timed out/i.test(msg)) {
    return { code: "TIMEOUT", message: msg, status: 504 };
  }
  if (msg === "VM_SUSPENDED") {
    return {
      code: "INVALID_STATE",
      message: "Suspended VMs must be powered off before starting or restarting",
      status: 400,
    };
  }
  return { code: "TRUENAS_ERROR", message: msg, status: 502 };
}
