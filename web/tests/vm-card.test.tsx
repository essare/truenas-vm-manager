import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { VmCardView } from "../src/components/vm-card";

const base = {
  id: 1,
  name: "media",
  vcpus: 4,
  memoryBytes: 4 * 1024 ** 3,
  autostart: true,
  guestOs: "linux" as const,
};

afterEach(cleanup);

describe("VmCardView", () => {
  test("stopped shows Start", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "STOPPED" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /start/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /power off/i }),
    ).toBeNull();
  });

  test("running shows Restart and Power off", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "RUNNING" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /restart/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /power off/i }),
    ).toBeInTheDocument();
  });

  test("suspended shows Power off only", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "SUSPENDED" }}
        busy={false}
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /power off/i }),
    ).toBeInTheDocument();
  });

  test("start button shows spinner while busy", () => {
    render(
      <VmCardView
        vm={{ ...base, state: "STOPPED" }}
        busy
        onStart={vi.fn()}
        onRestart={vi.fn()}
        onPoweroff={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /starting/i }),
    ).toBeInTheDocument();
  });
});
