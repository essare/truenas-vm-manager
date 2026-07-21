export type GuestOs =
  | "windows"
  | "ubuntu"
  | "debian"
  | "fedora"
  | "centos"
  | "rhel"
  | "arch"
  | "suse"
  | "alpine"
  | "kali"
  | "linux"
  | "macos"
  | "freebsd"
  | "android"
  | "raspberrypi"
  | "unknown";

/** Ordered from most specific name match to generic. */
const NAME_PATTERNS: Array<{ os: GuestOs; pattern: RegExp }> = [
  { os: "windows", pattern: /\b(windows|win(10|11|server)?|microsoft|msft)\b/i },
  { os: "ubuntu", pattern: /\bubuntu\b/i },
  { os: "debian", pattern: /\bdebian\b/i },
  { os: "fedora", pattern: /\bfedora\b/i },
  {
    os: "centos",
    pattern: /\b(centos|rocky|alma(linux)?)\b/i,
  },
  { os: "rhel", pattern: /\b(rhel|red\s?hat)\b/i },
  { os: "arch", pattern: /\barch(linux)?\b/i },
  { os: "suse", pattern: /\b(open)?suse\b/i },
  { os: "alpine", pattern: /\balpine\b/i },
  { os: "kali", pattern: /\bkali\b/i },
  { os: "macos", pattern: /\b(mac\s?os|macos|osx|darwin)\b/i },
  { os: "freebsd", pattern: /\bfreebsd\b/i },
  { os: "android", pattern: /\bandroid\b/i },
  { os: "raspberrypi", pattern: /\b(raspberry|raspi|rpi)\b/i },
  { os: "linux", pattern: /\b(linux|nixos|gentoo|mint)\b/i },
];

/**
 * Underscores/hyphens are word chars in JS `\b`, so `linux_ubuntu` never
 * matched `\bubuntu\b`. Normalize separators to spaces first.
 */
function normalizeGuestOsText(value: string): string {
  return value.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Infer guest OS for icons.
 *
 * TrueNAS `vm.query` does not expose a dedicated guest OS field. Signals used:
 * - `hyperv_enlightenments` (API) → Windows
 * - `name` + `description` string scan → distro-specific / generic
 * - otherwise → unknown (generic desktop fallback icon)
 */
export function inferGuestOs(row: {
  name: string;
  description?: string;
  hyperv_enlightenments?: boolean;
}): GuestOs {
  if (row.hyperv_enlightenments) return "windows";

  const text = normalizeGuestOsText(
    `${row.name} ${row.description ?? ""}`,
  );
  if (!text) return "unknown";

  for (const { os, pattern } of NAME_PATTERNS) {
    if (pattern.test(text)) return os;
  }
  return "unknown";
}
