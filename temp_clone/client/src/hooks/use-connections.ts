import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ActiveConnection, ActivityLog } from "@shared/schema";

export function useConnections() {
  return useQuery<ActiveConnection[]>({
    queryKey: ["/api/connections"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time data
  });
}

export function useKillConnection() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}

export function useActivityLog(lineId?: number, limit?: number) {
  return useQuery<ActivityLog[]>({
    queryKey: ["/api/activity", { lineId, limit }],
  });
}
