import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../src/lib/api";

describe("api.getStatus", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("requests status with session credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          setupRequired: false,
          unlocked: true,
          onboarded: true,
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );
    globalThis.fetch = fetchMock;

    await api.getStatus();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
