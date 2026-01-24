import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  streams: {
    total: number;
    online: number;
    offline: number;
  };
  users: {
    total: number;
    active: number;
    online: number;
  };
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  message?: string;
}

interface Alert {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'sms';
  condition: {
    metric: string;
    operator: string;
    value: number;
    duration?: number;
  };
  threshold: number;
  enabled: boolean;
  recipients: string[];
  cooldown: number;
  lastTriggered?: string;
  triggerCount: number;
  createdAt: string;
}

/**
 * Get latest system metrics
 */
export function useSystemMetrics() {
  return useQuery({
    queryKey: ['systemMetrics'],
    queryFn: async () => {
      const { data } = await axios.get<SystemMetrics>('/api/monitoring/metrics');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get system health
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['systemHealth'],
    queryFn: async () => {
      const { data } = await axios.get<{
        health: HealthCheck[];
        overall: 'healthy' | 'degraded' | 'unhealthy';
      }>('/api/monitoring/health');
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Get alerts
 */
export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await axios.get<{ alerts: Alert[] }>('/api/monitoring/alerts');
      return data.alerts;
    },
  });
}

/**
 * Create alert
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alert: Omit<Alert, 'id' | 'createdAt' | 'triggerCount'>) => {
      const { data } = await axios.post<Alert>('/api/monitoring/alerts', alert);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

/**
 * Update alert
 */
export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Alert> }) => {
      const { data } = await axios.put<Alert>(`/api/monitoring/alerts/${params.id}`, params.updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

/**
 * Delete alert
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/monitoring/alerts/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
