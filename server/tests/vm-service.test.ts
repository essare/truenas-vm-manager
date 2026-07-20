import { describe, expect, test } from "bun:test";
import { listVms, mapTrueNasError, type VmCallClient } from "../src/truenas/vm-service";

function mockClient(handlers: Record<string, (params: unknown[]) => unknown>): VmCallClient {
  return {
    call: async <T>(method: string, params: unknown[] = []) => {
      const h = handlers[method];
      if (!h) throw new Error(`unexpected ${method}`);
      return h(params) as T;
    },
  };
}

describe("listVms", () => {
  test("maps query + status", async () => {
    const client = mockClient({
      "vm.query": () => [
        {
          id: 1,
          name: "media",
          description: "ubuntu media server",
          vcpus: 4,
          memory: 8 * 1024 * 1024 * 1024,
          autostart: true,
        },
      ],
      "vm.status": () => ({ state: "RUNNING", pid: 1, domain_state: "running" }),
    });
    expect(await listVms(client)).toEqual([
      {
        id: 1,
        name: "media",
        state: "RUNNING",
        vcpus: 4,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        autostart: true,
        guestOs: "linux",
      },
    ]);
  });

  test("infers windows from hyperv enlightenments", async () => {
    const client = mockClient({
      "vm.query": () => [
        {
          id: 2,
          name: "desktop",
          vcpus: 2,
          memory: 4 * 1024 * 1024 * 1024,
          autostart: false,
          hyperv_enlightenments: true,
        },
      ],
      "vm.status": () => ({ state: "STOPPED", pid: null, domain_state: "shut off" }),
    });
    expect(await listVms(client)).toEqual([
      {
        id: 2,
        name: "desktop",
        state: "STOPPED",
        vcpus: 2,
        memoryBytes: 4 * 1024 * 1024 * 1024,
        autostart: false,
        guestOs: "windows",
      },
    ]);
  });
});

describe("mapTrueNasError", () => {
  test("ENOMEM", () => {
    const mapped = mapTrueNasError(new Error("ENOMEM: not enough free memory"));
    expect(mapped.status).toBe(400);
    expect(mapped.message).toContain("memory");
  });
});
