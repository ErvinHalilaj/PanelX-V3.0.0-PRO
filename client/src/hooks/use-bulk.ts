import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Stream } from "@shared/schema";

export function useBulkDeleteStreams() {
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/bulk/streams/delete", { ids });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });
}

export function useBulkUpdateStreams() {
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: number[]; updates: any }) => {
      const res = await apiRequest("POST", "/api/streams/bulk-edit", { streamIds: ids, updates });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update streams");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });
}

export function useBulkDeleteLines() {
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/bulk/lines/delete", { ids });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
    },
  });
}

export function useImportM3U() {
  return useMutation<
    { imported: number; streams: Stream[] },
    Error,
    { content: string; categoryId?: number; streamType?: "live" | "movie" }
  >({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/bulk/import/m3u", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });
}
