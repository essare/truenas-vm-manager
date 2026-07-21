import type { IconType } from "react-icons";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa";
import {
  SiAlpinelinux,
  SiAndroid,
  SiArchlinux,
  SiCentos,
  SiDebian,
  SiFedora,
  SiFreebsd,
  SiKalilinux,
  SiOpensuse,
  SiRaspberrypi,
  SiRedhat,
  SiUbuntu,
} from "react-icons/si";
import { TbDeviceDesktop } from "react-icons/tb";

import type { GuestOs } from "@/lib/types";
import { cn } from "@/lib/utils";

type GuestOsIconProps = {
  guestOs: GuestOs;
  className?: string;
};

const ICONS: Record<GuestOs, IconType> = {
  windows: FaWindows,
  ubuntu: SiUbuntu,
  debian: SiDebian,
  fedora: SiFedora,
  centos: SiCentos,
  rhel: SiRedhat,
  arch: SiArchlinux,
  suse: SiOpensuse,
  alpine: SiAlpinelinux,
  kali: SiKalilinux,
  linux: FaLinux,
  macos: FaApple,
  freebsd: SiFreebsd,
  android: SiAndroid,
  raspberrypi: SiRaspberrypi,
  unknown: TbDeviceDesktop,
};

export function GuestOsIcon({ guestOs, className }: GuestOsIconProps) {
  const Icon = ICONS[guestOs] ?? ICONS.unknown;
  return (
    <Icon
      aria-hidden
      className={cn("size-8 shrink-0 text-muted-foreground", className)}
      title={guestOs === "unknown" ? "Unknown OS" : guestOs}
    />
  );
}
