import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertBouquet } from "@shared/schema";

export function useBouquets() {
  return useQuery({
    queryKey: [api.bouquets.list.path],
    queryFn: async () => {
      const res = await fetch(api.bouquets.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bouquets");
      return api.bouquets.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateBouquet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertBouquet) => {
      const res = await fetch(api.bouquets.create.path, {
        method: api.bouquets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create bouquet");
      return api.bouquets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bouquets.list.path] });
    },
  });
}
