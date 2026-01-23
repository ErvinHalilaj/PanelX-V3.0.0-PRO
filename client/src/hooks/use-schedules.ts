import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface StreamSchedule {
  id: number;
  streamId: number;
  scheduleType: 'once' | 'daily' | 'weekly' | 'custom';
  startTime?: string;
  stopTime?: string;
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: number[];
  timezone: string;
  enabled: boolean;
  action: 'start' | 'stop' | 'both';
  cronExpression?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hook to get schedules for a stream
 */
export function useStreamSchedules(streamId: number, enabled = true) {
  return useQuery<{ schedules: StreamSchedule[] }>({
    queryKey: [`/api/streams/${streamId}/schedules`],
    enabled,
  });
}

/**
 * Hook to get all schedules
 */
export function useSchedules() {
  return useQuery<{ schedules: StreamSchedule[] }>({
    queryKey: ["/api/schedules"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to create a schedule
 */
export function useCreateSchedule() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ streamId, schedule }: { streamId: number; schedule: Partial<StreamSchedule> }) => {
      const res = await apiRequest("POST", `/api/streams/${streamId}/schedules`, schedule);
      return res.json();
    },
    onSuccess: (data, { streamId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/schedules`] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Schedule created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create schedule",
      });
    },
  });
}

/**
 * Hook to update a schedule
 */
export function useUpdateSchedule() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<StreamSchedule> }) => {
      const res = await apiRequest("PUT", `/api/schedules/${id}`, updates);
      return res.json();
    },
    onSuccess: (data) => {
      const streamId = data.schedule.streamId;
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${streamId}/schedules`] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Schedule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update schedule",
      });
    },
  });
}

/**
 * Hook to delete a schedule
 */
export function useDeleteSchedule() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete schedule",
      });
    },
  });
}
