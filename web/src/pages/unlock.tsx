import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

export function UnlockPage() {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");

  const unlock = useMutation({
    mutationFn: () => api.unlock(password),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["status"] }),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    unlock.mutate();
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unlock VM Manager</CardTitle>
          <CardDescription>
            Enter your administrator password to start this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoFocus
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {unlock.error ? (
              <p className="text-sm text-destructive" role="alert">
                {unlock.error.message}
              </p>
            ) : null}
            <Button className="w-full" disabled={unlock.isPending} type="submit">
              {unlock.isPending ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
