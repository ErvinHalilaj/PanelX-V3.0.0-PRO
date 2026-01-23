import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface Recording {
  id: number;
  streamId: number;
  archiveFile: string;
  startTime: Date;
  endTime: Date;
  fileSize: number;
  status: 'recording' | 'completed' | 'error';
  serverId?: number;
}

export interface StorageUsage {
  activeRecordings: number;
  storageUsed: number;
  storageUsedMB: string;
  storageUsedGB: string;
}

// Get all recordings
export function useRecordings() {
  return useQuery<Recording[]>({
    queryKey: ["/api/recordings"],
    refetchInterval: 5000, // Refresh every 5 seconds for recording status
  });
}

// Get single recording
export function useRecording(id: number) {
  return useQuery<Recording>({
    queryKey: ["/api/recordings", id],
    enabled: !!id,
  });
}

// Get storage usage
export function useStorageUsage() {
  return useQuery<StorageUsage>({
    queryKey: ["/api/recordings/storage/usage"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// Start recording
export function useStartRecording() {
  return useMutation({
    mutationFn: async ({ streamId, duration }: { streamId: number; duration?: number }) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/record/start`, { 
        duration: duration || 60 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings/storage/usage"] });
    },
  });
}

// Stop recording
export function useStopRecording() {
  return useMutation({
    mutationFn: async (recordingId: number) => {
      const res = await apiRequest("POST", `/api/recordings/${recordingId}/stop`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings/storage/usage"] });
    },
  });
}

// Delete recording
export function useDeleteRecording() {
  return useMutation({
    mutationFn: async (recordingId: number) => {
      await apiRequest("DELETE", `/api/recordings/${recordingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings/storage/usage"] });
    },
  });
}
