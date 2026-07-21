import { Loader2 } from "lucide-react";

import { GuestOsIcon } from "@/components/guest-os-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VmCard } from "@/lib/types";
import { cn } from "@/lib/utils";

type VmCardViewProps = {
  busy: boolean;
  onPoweroff: () => void;
  onRestart: () => void;
  onStart: () => void;
  vm: VmCard;
};

const stateLabels: Record<string, string> = {
  RUNNING: "Running",
  STOPPED: "Powered off",
  SUSPENDED: "Suspended",
};

function humanizeMemory(memoryBytes: number) {
  const gib = 1024 ** 3;
  const value = memoryBytes >= gib ? memoryBytes / gib : memoryBytes / 1024 ** 2;
  const unit = memoryBytes >= gib ? "GiB" : "MiB";

  return `${Number(value.toFixed(1))} ${unit}`;
}

function stateBadgeClass(state: string) {
  if (state === "RUNNING") {
    return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600";
  }
  if (state === "STOPPED") {
    return "border-transparent bg-red-600 text-white hover:bg-red-600";
  }
  return undefined;
}

export function VmCardView({
  busy,
  onPoweroff,
  onRestart,
  onStart,
  vm,
}: VmCardViewProps) {
  const stateLabel = stateLabels[vm.state] ?? vm.state;
  const starting = busy && vm.state === "STOPPED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <GuestOsIcon guestOs={vm.guestOs} />
          <div className="min-w-0 space-y-2">
            <CardTitle className="truncate">{vm.name}</CardTitle>
            <Badge
              className={cn(stateBadgeClass(vm.state))}
              variant={vm.state === "RUNNING" ? "default" : "secondary"}
            >
              {stateLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">vCPUs</dt>
            <dd className="font-medium">{vm.vcpus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Memory</dt>
            <dd className="font-medium">{humanizeMemory(vm.memoryBytes)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Autostart</dt>
            <dd className="font-medium">{vm.autostart ? "Enabled" : "Disabled"}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        {vm.state === "STOPPED" ? (
          <Button disabled={busy} onClick={onStart}>
            {starting ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Starting…
              </>
            ) : (
              "Start"
            )}
          </Button>
        ) : null}
        {vm.state === "RUNNING" ? (
          <Button disabled={busy} onClick={onRestart} variant="outline">
            Restart
          </Button>
        ) : null}
        {vm.state === "RUNNING" || vm.state === "SUSPENDED" ? (
          <Button disabled={busy} onClick={onPoweroff} variant="destructive">
            Power off
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
