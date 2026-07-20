import type { AppStatus, VmCard } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as { error?: { message?: string } };
    throw new Error(error.error?.message ?? response.statusText);
  }

  return data as T;
}

export const api = {
  getStatus: () => request<AppStatus>("/api/status"),
  setup: (password: string) =>
    request("/api/setup", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  unlock: (password: string) =>
    request("/api/unlock", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request("/api/logout", { method: "POST", body: "{}" }),
  connectTrueNas: (host: string, apiKey: string, username = "root") =>
    request("/api/truenas/connect", {
      method: "POST",
      body: JSON.stringify({ host, apiKey, username }),
    }),
  disconnectTrueNas: () =>
    request("/api/truenas/connect", { method: "DELETE" }),
  listVms: () => request<{ vms: VmCard[] }>("/api/vms"),
  startVm: (id: number) =>
    request(`/api/vms/${id}/start`, { method: "POST", body: "{}" }),
  restartVm: (id: number) =>
    request(`/api/vms/${id}/restart`, { method: "POST", body: "{}" }),
  poweroffVm: (id: number) =>
    request(`/api/vms/${id}/poweroff`, { method: "POST", body: "{}" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/api/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
