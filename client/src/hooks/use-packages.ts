import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Package, InsertPackage } from "@shared/schema";

export function usePackages() {
  return useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });
}

export function usePackage(id: number) {
  return useQuery<Package>({
    queryKey: ["/api/packages", id],
  });
}

export function useCreatePackage() {
  return useMutation({
    mutationFn: async (data: InsertPackage) => {
      const res = await apiRequest("POST", "/api/packages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
  });
}

export function useUpdatePackage() {
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertPackage> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/packages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
  });
}

export function useDeletePackage() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
  });
}
