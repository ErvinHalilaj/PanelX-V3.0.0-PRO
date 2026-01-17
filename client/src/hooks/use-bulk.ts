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
