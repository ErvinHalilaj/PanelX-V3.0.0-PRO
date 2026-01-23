import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface TimeshiftPosition {
  streamId: number;
  position: number;
  timestamp: string;
  availableRange: {
    start: number;
    end: number;
  };
}

export interface TimeshiftSession {
  streamId: number;
  status: 'buffering' | 'active' | 'stopped' | 'error';
  startTime: string;
  currentPosition: number;
  segmentCount: number;
}

/**
 * Hook to get timeshift position for a stream
 */
export function useTimeshiftPosition(streamId: number, enabled = true) {
  return useQuery<TimeshiftPosition>({
    queryKey: [`/api/streams/${streamId}/timeshift/position`],
    enabled,
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: false,
  });
}

/**
 * Hook to get all active timeshift sessions
 */
export function useTimeshiftSessions() {
  return useQuery<{ sessions: TimeshiftSession[] }>({
    queryKey: ["/api/timeshift/sessions"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

/**
 * Hook to start timeshift for a stream
 */
export function useStartTimeshift() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (streamId: number) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/timeshift/start`);
      return res.json();
    },
    onSuccess: (data, streamId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/timeshift/position`] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeshift/sessions"] });
      toast({
        title: "Success",
        description: "Timeshift started successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start timeshift",
      });
    },
  });
}

/**
 * Hook to stop timeshift for a stream
 */
export function useStopTimeshift() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (streamId: number) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/timeshift/stop`);
      return res.json();
    },
    onSuccess: (data, streamId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/timeshift/position`] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeshift/sessions"] });
      toast({
        title: "Success",
        description: "Timeshift stopped",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to stop timeshift",
      });
    },
  });
}

/**
 * Hook to seek to a specific position
 */
export function useTimeshiftSeek() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ streamId, position }: { streamId: number; position: number }) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/timeshift/seek`, { position });
      return res.json();
    },
    onSuccess: (data, { streamId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/timeshift/position`] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to seek",
      });
    },
  });
}

/**
 * Hook to watch from start
 */
export function useWatchFromStart() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (streamId: number) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/timeshift/watch-from-start`);
      return res.json();
    },
    onSuccess: (data, streamId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/timeshift/position`] });
      toast({
        title: "Success",
        description: "Watching from start",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to watch from start",
      });
    },
  });
}

/**
 * Hook to go live
 */
export function useGoLive() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (streamId: number) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/timeshift/go-live`);
      return res.json();
    },
    onSuccess: (data, streamId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/timeshift/position`] });
      toast({
        title: "Success",
        description: "Switched to live",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to switch to live",
      });
    },
  });
}
