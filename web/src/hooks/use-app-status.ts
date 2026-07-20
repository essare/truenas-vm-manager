import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useAppStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: api.getStatus,
  });
}
