import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, InsertUser } from "@shared/schema";

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
  });
}

export function useUser(id: number) {
  return useQuery<User>({
    queryKey: ["/api/users", id],
    enabled: !!id,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertUser> }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useAddCredits() {
  return useMutation({
    mutationFn: async ({ id, amount, reason }: { id: number; amount: number; reason?: string }) => {
      const res = await apiRequest("POST", `/api/users/${id}/credits`, { amount, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}
