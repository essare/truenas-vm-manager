// server/tests/http.test.ts
import { describe, expect, test } from "bun:test";
import { errorJson, json } from "../src/http";

describe("http helpers", () => {
  test("json sets application/json", async () => {
    const res = json({ ok: true });
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  test("errorJson shape", async () => {
    const res = errorJson(400, "BAD_REQUEST", "Nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "Nope" },
    });
  });
});
