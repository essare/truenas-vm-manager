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

export type AppStatus = {
  setupRequired: boolean;
  unlocked: boolean;
  onboarded: boolean;
  host?: string;
};

export type VmCard = {
  id: number;
  name: string;
  state: string;
  vcpus: number;
  memoryBytes: number;
  autostart: boolean;
  guestOs: GuestOs;
};
