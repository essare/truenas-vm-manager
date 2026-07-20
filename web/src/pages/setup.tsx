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

export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const setup = useMutation({
    mutationFn: () => api.setup(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["status"] });
      navigate("/unlock", { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmation) {
      setValidationError("Passwords do not match.");
      return;
    }

    setup.mutate();
  }

  const error = validationError ?? setup.error?.message;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your administrator password</CardTitle>
          <CardDescription>
            This password encrypts the TrueNAS credentials stored by the
            manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirm password</Label>
              <Input
                id="confirmation"
                minLength={8}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={setup.isPending} type="submit">
              {setup.isPending ? "Creating…" : "Create password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
