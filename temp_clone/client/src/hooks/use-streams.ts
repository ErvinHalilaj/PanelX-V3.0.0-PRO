import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertStream, Stream } from "@shared/schema";

export function useStreams(categoryId?: string) {
  return useQuery({
    queryKey: [api.streams.list.path, categoryId],
    queryFn: async () => {
      const url = categoryId 
        ? `${api.streams.list.path}?categoryId=${categoryId}` 
        : api.streams.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch streams");
      return api.streams.list.responses[200].parse(await res.json());
    },
  });
}

export function useStream(id: number) {
  return useQuery({
    queryKey: [api.streams.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.streams.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch stream");
      return api.streams.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStream) => {
      const res = await fetch(api.streams.create.path, {
        method: api.streams.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create stream");
      return api.streams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.streams.list.path] });
    },
  });
}

export function useUpdateStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertStream>) => {
      const url = buildUrl(api.streams.update.path, { id });
      const res = await fetch(url, {
        method: api.streams.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update stream");
      return api.streams.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.streams.list.path] });
    },
  });
}

export function useDeleteStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.streams.delete.path, { id });
      const res = await fetch(url, {
        method: api.streams.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete stream");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.streams.list.path] });
    },
  });
}
