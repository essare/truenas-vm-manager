import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  action: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ConfirmDialog({
  action,
  description,
  isPending,
  onConfirm,
  onOpenChange,
  open,
}: ConfirmDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{action} virtual machine?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onConfirm} variant="destructive">
            {isPending ? `${action}ing…` : action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
