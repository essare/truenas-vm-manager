import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [pendingVmId, setPendingVmId] = useState<number | null>(null);
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
    onSettled: () => setPendingVmId(null),
  });

  const restart = useMutation({
    mutationFn: api.restartVm,
    onSuccess: async () => {
      toast.success("Virtual machine restarted.");
      await refreshVms();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setConfirmation(null);
      setPendingVmId(null);
    },
  });

  const poweroff = useMutation({
    mutationFn: api.poweroffVm,
    onSuccess: async () => {
      toast.success("Virtual machine powered off.");
      await refreshVms();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setConfirmation(null);
      setPendingVmId(null);
    },
  });

  const isBusy =
    start.isPending || restart.isPending || poweroff.isPending;

  function handleStart(vm: VmCard) {
    setPendingVmId(vm.id);
    start.mutate(vm.id);
  }

  function handleConfirm() {
    if (!confirmation) {
      return;
    }

    setPendingVmId(confirmation.vm.id);
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
        <div>
          <h1 className="text-2xl font-semibold">TrueNAS VM Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage your virtual machines.
          </p>
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
                busy={isBusy && pendingVmId === vm.id}
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
          isPending={isBusy}
          onConfirm={handleConfirm}
          onOpenChange={(open) => {
            if (!open && !isBusy) {
              setConfirmation(null);
            }
          }}
          open
        />
      ) : null}
    </main>
  );
}
