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

export function VmCardView({
  busy,
  onPoweroff,
  onRestart,
  onStart,
  vm,
}: VmCardViewProps) {
  const stateLabel = stateLabels[vm.state] ?? vm.state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{vm.name}</CardTitle>
        <Badge variant={vm.state === "RUNNING" ? "default" : "secondary"}>
          {stateLabel}
        </Badge>
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
            Start
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
