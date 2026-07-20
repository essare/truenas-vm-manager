import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useVms() {
  return useQuery({
    queryKey: ["vms"],
    queryFn: api.listVms,
    refetchInterval: 4000,
  });
}
