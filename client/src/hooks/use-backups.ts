import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Backup {
  id: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  status: 'pending' | 'running' | 'completed' | 'failed';
  size: number;
  path: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  metadata: {
    version: string;
    tables?: string[];
    fileCount?: number;
    compression: 'none' | 'gzip' | 'bzip2';
  };
}

interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  retention: number;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface RestorePoint {
  backupId: string;
  timestamp: string;
  description: string;
  verified: boolean;
}

interface BackupStats {
  total: number;
  completed: number;
  failed: number;
  totalSize: number;
  lastBackup?: string;
  nextScheduled?: string;
}

/**
 * List backups
 */
export function useBackups(type?: Backup['type'], limit = 50) {
  return useQuery({
    queryKey: ['backups', type, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (limit) params.append('limit', limit.toString());

      const { data } = await axios.get<{ backups: Backup[] }>(`/api/backups?${params}`);
      return data.backups;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get backup by ID
 */
export function useBackup(id: string) {
  return useQuery({
    queryKey: ['backup', id],
    queryFn: async () => {
      const { data } = await axios.get<Backup>(`/api/backups/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create backup
 */
export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: Backup['type']) => {
      const { data } = await axios.post<Backup>('/api/backups', { type });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupStats'] });
    },
  });
}

/**
 * Delete backup
 */
export function useDeleteBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/backups/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupStats'] });
    },
  });
}

/**
 * Restore backup
 */
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; verify?: boolean }) => {
      const { data } = await axios.post(`/api/backups/${params.id}/restore`, {
        verify: params.verify,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restorePoints'] });
    },
  });
}

/**
 * Verify backup
 */
export function useVerifyBackup() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ valid: boolean }>(`/api/backups/${id}/verify`);
      return data;
    },
  });
}

/**
 * Get backup statistics
 */
export function useBackupStats() {
  return useQuery({
    queryKey: ['backupStats'],
    queryFn: async () => {
      const { data } = await axios.get<BackupStats>('/api/backups/stats/summary');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * List backup schedules
 */
export function useBackupSchedules() {
  return useQuery({
    queryKey: ['backupSchedules'],
    queryFn: async () => {
      const { data } = await axios.get<{ schedules: BackupSchedule[] }>('/api/backups/schedules/all');
      return data.schedules;
    },
  });
}

/**
 * Get backup schedule by ID
 */
export function useBackupSchedule(id: string) {
  return useQuery({
    queryKey: ['backupSchedule', id],
    queryFn: async () => {
      const { data } = await axios.get<BackupSchedule>(`/api/backups/schedules/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create backup schedule
 */
export function useCreateBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: Omit<BackupSchedule, 'id'>) => {
      const { data } = await axios.post<BackupSchedule>('/api/backups/schedules', schedule);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backupSchedules'] });
    },
  });
}

/**
 * Update backup schedule
 */
export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<BackupSchedule> }) => {
      const { data } = await axios.put<BackupSchedule>(
        `/api/backups/schedules/${params.id}`,
        params.updates
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backupSchedule', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['backupSchedules'] });
    },
  });
}

/**
 * Delete backup schedule
 */
export function useDeleteBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/backups/schedules/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backupSchedules'] });
    },
  });
}

/**
 * Get restore points
 */
export function useRestorePoints() {
  return useQuery({
    queryKey: ['restorePoints'],
    queryFn: async () => {
      const { data } = await axios.get<{ restorePoints: RestorePoint[] }>('/api/backups/restore-points');
      return data.restorePoints;
    },
  });
}
