import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { VmCardView } from "@/components/vm-card";
import { Button } from "@/components/ui/button";
import { useVms } from "@/hooks/use-vms";
import { api } from "@/lib/api";
import type { VmCard } from "@/lib/types";

type ConfirmedAction = "restart" | "poweroff";

type PendingConfirmation = {
  action: ConfirmedAction;
  vm: VmCard;
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const vmsQuery = useVms();
  const [pendingVmIds, setPendingVmIds] = useState<Set<number>>(new Set());
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null,
  );

  async function refreshVms() {
    await queryClient.invalidateQueries({ queryKey: ["vms"] });
  }

  const start = useMutation({
    mutationFn: api.startVm,
    onSuccess: async () => {
      toast.success("Virtual machine started.");
      await refreshVms();
    },
    onError: (error) => toast.error(error.message),
    onSettled: (_data, _error, id) => {
      setPendingVmIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    },
  });

  const restart = useMutation({
    mutationFn: api.restartVm,
    onSuccess: async () => {
      toast.success("Virtual machine restarted.");
      await refreshVms();
    },
    onError: (error) => toast.error(error.message),
    onSettled: (_data, _error, id) => {
      setConfirmation(null);
      setPendingVmIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    },
  });

  const poweroff = useMutation({
    mutationFn: api.poweroffVm,
    onSuccess: async () => {
      toast.success("Virtual machine powered off.");
      await refreshVms();
    },
    onError: (error) => toast.error(error.message),
    onSettled: (_data, _error, id) => {
      setConfirmation(null);
      setPendingVmIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    },
  });

  function handleStart(vm: VmCard) {
    setPendingVmIds((ids) => new Set(ids).add(vm.id));
    start.mutate(vm.id);
  }

  function handleConfirm() {
    if (!confirmation) {
      return;
    }

    setPendingVmIds((ids) => new Set(ids).add(confirmation.vm.id));
    if (confirmation.action === "restart") {
      restart.mutate(confirmation.vm.id);
      return;
    }

    poweroff.mutate(confirmation.vm.id);
  }

  if (vmsQuery.isPending) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <p className="text-sm text-muted-foreground">Loading virtual machines…</p>
      </main>
    );
  }

  if (vmsQuery.isError) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm text-destructive">
            Could not load virtual machines.
          </p>
          <Button onClick={() => vmsQuery.refetch()}>Try again</Button>
        </div>
      </main>
    );
  }

  const vms = vmsQuery.data.vms;

  return (
    <main className="min-h-svh bg-muted/30 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">TrueNAS VM Manager</h1>
            <p className="text-sm text-muted-foreground">
              Manage your virtual machines.
            </p>
          </div>
          <Link className="text-sm font-medium underline-offset-4 hover:underline" to="/settings">
            Settings
          </Link>
        </div>

        {vms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <h2 className="font-medium">No virtual machines found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a virtual machine in TrueNAS to manage it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vms.map((vm) => (
              <VmCardView
                busy={pendingVmIds.has(vm.id)}
                key={vm.id}
                onPoweroff={() =>
                  setConfirmation({ action: "poweroff", vm })
                }
                onRestart={() => setConfirmation({ action: "restart", vm })}
                onStart={() => handleStart(vm)}
                vm={vm}
              />
            ))}
          </div>
        )}
      </div>

      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action === "restart" ? "Restart" : "Power off"}
          description={`Are you sure you want to ${confirmation.action === "restart" ? "restart" : "power off"} ${confirmation.vm.name}?`}
          isPending={pendingVmIds.has(confirmation.vm.id)}
          onConfirm={handleConfirm}
          onOpenChange={(open) => {
            if (!open && !pendingVmIds.has(confirmation.vm.id)) {
              setConfirmation(null);
            }
          }}
          open
        />
      ) : null}
    </main>
  );
}
