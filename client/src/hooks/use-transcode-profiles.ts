import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TranscodeProfile, InsertTranscodeProfile } from "@shared/schema";

export function useTranscodeProfiles() {
  return useQuery<TranscodeProfile[]>({
    queryKey: ["/api/transcode-profiles"],
  });
}

export function useCreateTranscodeProfile() {
  return useMutation({
    mutationFn: async (data: InsertTranscodeProfile) => {
      const res = await apiRequest("POST", "/api/transcode-profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcode-profiles"] });
    },
  });
}

export function useDeleteTranscodeProfile() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transcode-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcode-profiles"] });
    },
  });
}
