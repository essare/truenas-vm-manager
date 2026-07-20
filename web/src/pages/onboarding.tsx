import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { api } from "@/lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");

  const connect = useMutation({
    mutationFn: () => api.connectTrueNas(host, apiKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["status"] });
      navigate("/", { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    connect.mutate();
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect your TrueNAS system</CardTitle>
          <CardDescription>
            Use the HTTPS address (for example https://truenas.home.arpa:4443).
            Plain http:// will disable your API key on TrueNAS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="host">TrueNAS host</Label>
              <Input
                autoFocus
                id="host"
                onChange={(event) => setHost(event.target.value)}
                placeholder="https://truenas.home.arpa:4443"
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
            {connect.error ? (
              <p className="text-sm text-destructive" role="alert">
                {connect.error.message}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={connect.isPending}
              type="submit"
            >
              {connect.isPending ? "Connecting…" : "Connect TrueNAS"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
