import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ResellerGroup, InsertResellerGroup } from "@shared/schema";

export function useResellerGroups() {
  return useQuery<ResellerGroup[]>({
    queryKey: ["/api/reseller-groups"],
  });
}

export function useResellerGroup(id: number) {
  return useQuery<ResellerGroup>({
    queryKey: ["/api/reseller-groups", id],
  });
}

export function useCreateResellerGroup() {
  return useMutation({
    mutationFn: async (data: InsertResellerGroup) => {
      const res = await apiRequest("POST", "/api/reseller-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reseller-groups"] });
    },
  });
}

export function useUpdateResellerGroup() {
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertResellerGroup> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/reseller-groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reseller-groups"] });
    },
  });
}

export function useDeleteResellerGroup() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/reseller-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reseller-groups"] });
    },
  });
}
