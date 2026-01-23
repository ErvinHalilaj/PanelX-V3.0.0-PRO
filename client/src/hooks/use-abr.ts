import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface QualityVariant {
  id: string;
  label: string;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
  bandwidth: number;
  enabled: boolean;
}

export interface ABRSession {
  streamId: number;
  status: 'initializing' | 'active' | 'stopped' | 'error';
  variants: QualityVariant[];
  masterPlaylist: string;
}

/**
 * Hook to get ABR session for a stream
 */
export function useABRSession(streamId: number, enabled = true) {
  return useQuery<ABRSession>({
    queryKey: [`/api/streams/${streamId}/abr/session`],
    enabled,
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });
}

/**
 * Hook to get available quality variants
 */
export function useQualityVariants(streamId: number, enabled = true) {
  return useQuery<{ streamId: number; variants: QualityVariant[] }>({
    queryKey: [`/api/streams/${streamId}/abr/variants`],
    enabled,
  });
}

/**
 * Hook to get all active ABR sessions
 */
export function useABRSessions() {
  return useQuery<{ sessions: Array<{ streamId: number; status: string; variantCount: number }> }>({
    queryKey: ["/api/abr/sessions"],
    refetchInterval: 10000,
  });
}

/**
 * Hook to start adaptive bitrate streaming
 */
export function useStartABR() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ streamId, variants }: { streamId: number; variants?: QualityVariant[] }) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/abr/start`, { variants });
      return res.json();
    },
    onSuccess: (data, { streamId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/abr/session`] });
      queryClient.invalidateQueries({ queryKey: ["/api/abr/sessions"] });
      toast({
        title: "Success",
        description: "Adaptive bitrate streaming started",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start adaptive bitrate streaming",
      });
    },
  });
}

/**
 * Hook to stop adaptive bitrate streaming
 */
export function useStopABR() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (streamId: number) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/abr/stop`);
      return res.json();
    },
    onSuccess: (data, streamId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/abr/session`] });
      queryClient.invalidateQueries({ queryKey: ["/api/abr/sessions"] });
      toast({
        title: "Success",
        description: "Adaptive bitrate streaming stopped",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to stop adaptive bitrate streaming",
      });
    },
  });
}
