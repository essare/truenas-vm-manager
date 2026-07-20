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
};
