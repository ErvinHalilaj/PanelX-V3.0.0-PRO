import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertLine, Line } from "@shared/schema";

export function useLines() {
  return useQuery({
    queryKey: [api.lines.list.path],
    queryFn: async () => {
      const res = await fetch(api.lines.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lines");
      return api.lines.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertLine) => {
      const res = await fetch(api.lines.create.path, {
        method: api.lines.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create line");
      return api.lines.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lines.list.path] });
    },
  });
}

export function useUpdateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertLine>) => {
      const url = buildUrl(api.lines.update.path, { id });
      const res = await fetch(url, {
        method: api.lines.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update line");
      return api.lines.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lines.list.path] });
    },
  });
}

export function useDeleteLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.lines.delete.path, { id });
      const res = await fetch(url, {
        method: api.lines.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete line");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lines.list.path] });
    },
  });
}
