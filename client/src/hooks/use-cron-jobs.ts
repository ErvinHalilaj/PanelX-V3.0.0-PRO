import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  runCount: number;
  averageRunTime: number;
  createdAt: string;
  updatedAt: string;
}

interface CronJobExecution {
  id: string;
  jobId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output?: string;
  error?: string;
}

/**
 * Get cron jobs
 */
export function useCronJobs() {
  return useQuery({
    queryKey: ['cronJobs'],
    queryFn: async () => {
      const { data } = await axios.get<{ jobs: CronJob[] }>('/api/cron-jobs');
      return data.jobs;
    },
  });
}

/**
 * Create cron job
 */
export function useCreateCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'averageRunTime'>) => {
      const { data } = await axios.post<CronJob>('/api/cron-jobs', job);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
    },
  });
}

/**
 * Update cron job
 */
export function useUpdateCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<CronJob> }) => {
      const { data } = await axios.put<CronJob>(`/api/cron-jobs/${params.id}`, params.updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
    },
  });
}

/**
 * Delete cron job
 */
export function useDeleteCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/cron-jobs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
    },
  });
}

/**
 * Run cron job manually
 */
export function useRunCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post(`/api/cron-jobs/${id}/run`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
      queryClient.invalidateQueries({ queryKey: ['cronExecutions'] });
    },
  });
}

/**
 * Get cron job executions
 */
export function useCronExecutions(jobId?: string) {
  return useQuery({
    queryKey: ['cronExecutions', jobId],
    queryFn: async () => {
      const params = jobId ? `?jobId=${jobId}` : '';
      const { data } = await axios.get<{ executions: CronJobExecution[] }>(`/api/cron-jobs/executions${params}`);
      return data.executions;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
