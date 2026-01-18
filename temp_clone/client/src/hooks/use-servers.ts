import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Server, InsertServer } from "@shared/schema";

export function useServers() {
  return useQuery<Server[]>({
    queryKey: ["/api/servers"],
  });
}

export function useCreateServer() {
  return useMutation({
    mutationFn: async (data: InsertServer) => {
      const res = await apiRequest("POST", "/api/servers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
    },
  });
}

export function useDeleteServer() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
    },
  });
}
