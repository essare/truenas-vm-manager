import { Monitor } from "lucide-react";

import type { GuestOs } from "@/lib/types";
import { cn } from "@/lib/utils";

type GuestOsIconProps = {
  guestOs: GuestOs;
  className?: string;
};

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M3 5.5 10.5 4.4v7.1H3zm8.5-.9L21 3v8.5h-9.5zM3 13.5h7.5v7.1L3 19.5zm8.5 0H21V21l-9.5-1.4z" />
    </svg>
  );
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path d="M12 3c-2.2 1.4-3.5 3.7-3.5 6.2 0 1.6.5 2.8 1.2 3.8-.8.5-1.7 1.5-1.7 3 0 1.7 1.4 2.5 3 2.5h4c1.6 0 3-.8 3-2.5 0-1.5-.9-2.5-1.7-3 .7-1 1.2-2.2 1.2-3.8C17.5 6.7 16.2 4.4 14 3" />
      <circle cx="9.5" cy="9.5" fill="currentColor" r="0.8" stroke="none" />
      <circle cx="14.5" cy="9.5" fill="currentColor" r="0.8" stroke="none" />
      <path d="M10 13.2c.6.5 1.3.8 2 .8s1.4-.3 2-.8" />
    </svg>
  );
}

export function GuestOsIcon({ guestOs, className }: GuestOsIconProps) {
  const classes = cn("size-8 text-muted-foreground", className);

  if (guestOs === "windows") {
    return <WindowsIcon className={classes} />;
  }
  if (guestOs === "linux") {
    return <LinuxIcon className={classes} />;
  }
  return <Monitor aria-hidden className={classes} />;
}
