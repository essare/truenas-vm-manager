import { describe, expect, test } from "bun:test";
import {
  listVms,
  mapTrueNasError,
  type VmCallClient,
} from "../src/truenas/vm-service";
import { inferGuestOs } from "../src/truenas/guest-os";

function mockClient(
  handlers: Record<string, (params: unknown[]) => unknown>,
): VmCallClient {
  return {
    call: async <T>(method: string, params: unknown[] = []) => {
      const h = handlers[method];
      if (!h) throw new Error(`unexpected ${method}`);
      return h(params) as T;
    },
  };
}

describe("inferGuestOs", () => {
  test("uses hyperv enlightenments as windows signal from the API", () => {
    expect(
      inferGuestOs({ name: "box", hyperv_enlightenments: true }),
    ).toBe("windows");
  });

  test("scans name and description for specific distros", () => {
    expect(inferGuestOs({ name: "prod-ubuntu-01" })).toBe("ubuntu");
    expect(inferGuestOs({ name: "db", description: "Debian 12" })).toBe(
      "debian",
    );
    expect(inferGuestOs({ name: "win11-lab" })).toBe("windows");
    expect(inferGuestOs({ name: "nas" })).toBe("unknown");
  });

  test("treats underscores as separators so linux_ubuntu names match", () => {
    expect(inferGuestOs({ name: "linux_ubuntu_24_04_3_desktop" })).toBe(
      "ubuntu",
    );
    expect(inferGuestOs({ name: "linux_kali_2025_4_amd64" })).toBe("kali");
    expect(inferGuestOs({ name: "windows_11_pro_en" })).toBe("windows");
    expect(inferGuestOs({ name: "linux_ubuntu_server_openclaw" })).toBe(
      "ubuntu",
    );
  });
});

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
        guestOs: "ubuntu",
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
      "vm.status": () => ({
        state: "STOPPED",
        pid: null,
        domain_state: "shut off",
      }),
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
