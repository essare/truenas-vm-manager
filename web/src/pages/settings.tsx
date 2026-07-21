import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStatus } from "@/hooks/use-app-status";
import { api } from "@/lib/api";

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statusQuery = useAppStatus();
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const connectedHost = statusQuery.data?.host;

  useEffect(() => {
    if (connectedHost) {
      setHost((currentHost) => currentHost || connectedHost);
    }
  }, [connectedHost]);

  async function refreshStatus() {
    await queryClient.invalidateQueries({ queryKey: ["status"] });
  }

  const reconnect = useMutation({
    mutationFn: () => api.connectTrueNas(host, apiKey),
    onSuccess: async () => {
      await refreshStatus();
      navigate("/", { replace: true });
    },
  });

  const disconnect = useMutation({
    mutationFn: api.disconnectTrueNas,
    onSuccess: async () => {
      await refreshStatus();
      navigate("/onboarding", { replace: true });
    },
  });

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await refreshStatus();
      navigate("/unlock", { replace: true });
    },
  });

  function handleReconnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reconnect.mutate();
  }

  function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changePassword.mutate();
  }

  return (
    <main className="min-h-svh bg-muted/30 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your TrueNAS connection and application access.
            </p>
          </div>
          <Button
            aria-label="Close settings"
            className="size-8 shrink-0"
            onClick={() => navigate("/")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>TrueNAS connection</CardTitle>
            <CardDescription>
              {statusQuery.data?.host
                ? `Connected to ${statusQuery.data.host}`
                : "No TrueNAS system is connected."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleReconnect}>
              <div className="space-y-2">
                <Label htmlFor="host">TrueNAS host</Label>
                <Input
                  id="host"
                  onChange={(event) => setHost(event.target.value)}
                  placeholder="https://192.168.1.10:443"
                  required
                  type="text"
                  value={host}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API key</Label>
                <Input
                  autoComplete="off"
                  id="api-key"
                  onChange={(event) => setApiKey(event.target.value)}
                  required
                  type="password"
                  value={apiKey}
                />
              </div>
              {reconnect.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {reconnect.error.message}
                </p>
              ) : null}
              <Button disabled={reconnect.isPending} type="submit">
                {reconnect.isPending ? "Connecting…" : "Reconnect TrueNAS"}
              </Button>
            </form>
            {statusQuery.data?.host ? (
              <Button
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
                type="button"
                variant="destructive"
              >
                {disconnect.isPending ? "Disconnecting…" : "Disconnect TrueNAS"}
              </Button>
            ) : null}
            {disconnect.error ? (
              <p className="text-sm text-destructive" role="alert">
                {disconnect.error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Use at least eight characters for your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  autoComplete="current-password"
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  autoComplete="new-password"
                  id="new-password"
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
              </div>
              {changePassword.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {changePassword.error.message}
                </p>
              ) : null}
              {changePassword.isSuccess ? (
                <p className="text-sm text-green-700" role="status">
                  Password changed.
                </p>
              ) : null}
              <Button disabled={changePassword.isPending} type="submit">
                {changePassword.isPending ? "Changing…" : "Change password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>End this administrator session.</CardDescription>
          </CardHeader>
          <CardContent>
            {logout.error ? (
              <p className="mb-4 text-sm text-destructive" role="alert">
                {logout.error.message}
              </p>
            ) : null}
            <Button
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              type="button"
              variant="outline"
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
