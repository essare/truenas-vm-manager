import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppStatus } from "@/hooks/use-app-status";
import type { AppStatus } from "@/lib/types";

// oxlint-disable-next-line react/only-export-components -- kept here as the route guard's testable policy
export function resolveRoute(
  status: AppStatus,
  path: string,
): string | null {
  if (status.setupRequired) {
    return path === "/setup" ? null : "/setup";
  }

  if (!status.unlocked) {
    return path === "/unlock" ? null : "/unlock";
  }

  if (!status.onboarded) {
    return path === "/onboarding" || path === "/settings"
      ? null
      : "/onboarding";
  }

  if (["/setup", "/unlock", "/onboarding"].includes(path)) {
    return "/";
  }

  return null;
}

export function RouteGuards() {
  const location = useLocation();
  const statusQuery = useAppStatus();

  if (statusQuery.isPending) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </main>
    );
  }

  if (statusQuery.isError) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm text-destructive">
            Could not load the application status.
          </p>
          <Button onClick={() => statusQuery.refetch()}>Try again</Button>
        </div>
      </main>
    );
  }

  const redirect = resolveRoute(statusQuery.data, location.pathname);
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
}
