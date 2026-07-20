import { describe, expect, test } from "vitest";

import { resolveRoute } from "../src/components/route-guards";
import type { AppStatus } from "../src/lib/types";

const status = (
  overrides: Partial<AppStatus> = {},
): AppStatus => ({
  setupRequired: false,
  unlocked: false,
  onboarded: false,
  ...overrides,
});

describe("resolveRoute", () => {
  test("redirects every route to setup while setup is required", () => {
    expect(resolveRoute(status({ setupRequired: true }), "/")).toBe("/setup");
    expect(resolveRoute(status({ setupRequired: true }), "/unlock")).toBe(
      "/setup",
    );
    expect(resolveRoute(status({ setupRequired: true }), "/setup")).toBeNull();
  });

  test("redirects locked applications to unlock", () => {
    expect(resolveRoute(status(), "/")).toBe("/unlock");
    expect(resolveRoute(status(), "/onboarding")).toBe("/unlock");
    expect(resolveRoute(status(), "/unlock")).toBeNull();
  });

  test("redirects unlocked applications to onboarding until connected", () => {
    const unlocked = status({ unlocked: true });

    expect(resolveRoute(unlocked, "/")).toBe("/onboarding");
    expect(resolveRoute(unlocked, "/unlock")).toBe("/onboarding");
    expect(resolveRoute(unlocked, "/onboarding")).toBeNull();
    expect(resolveRoute(unlocked, "/settings")).toBeNull();
  });

  test("redirects completed applications away from auth routes", () => {
    const complete = status({ unlocked: true, onboarded: true });

    expect(resolveRoute(complete, "/setup")).toBe("/");
    expect(resolveRoute(complete, "/unlock")).toBe("/");
    expect(resolveRoute(complete, "/onboarding")).toBe("/");
    expect(resolveRoute(complete, "/")).toBeNull();
    expect(resolveRoute(complete, "/settings")).toBeNull();
  });
});
