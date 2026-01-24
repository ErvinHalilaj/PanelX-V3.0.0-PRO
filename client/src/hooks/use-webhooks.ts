import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  headers?: Record<string, string>;
  retryAttempts: number;
  timeout: number;
  createdAt: string;
  lastTriggered?: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  response?: {
    status: number;
    body: string;
  };
  error?: string;
  createdAt: string;
  deliveredAt?: string;
}

/**
 * Get webhooks
 */
export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data } = await axios.get<{ webhooks: Webhook[] }>('/api/webhooks');
      return data.webhooks;
    },
  });
}

/**
 * Create webhook
 */
export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhook: Omit<Webhook, 'id' | 'createdAt'>) => {
      const { data } = await axios.post<Webhook>('/api/webhooks', webhook);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

/**
 * Update webhook
 */
export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Webhook> }) => {
      const { data } = await axios.put<Webhook>(`/api/webhooks/${params.id}`, params.updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

/**
 * Delete webhook
 */
export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/webhooks/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

/**
 * Get webhook deliveries
 */
export function useWebhookDeliveries(webhookId?: string) {
  return useQuery({
    queryKey: ['webhookDeliveries', webhookId],
    queryFn: async () => {
      const url = webhookId 
        ? `/api/webhooks/${webhookId}/deliveries`
        : '/api/webhooks/deliveries';
      const { data } = await axios.get<{ deliveries: WebhookDelivery[] }>(url);
      return data.deliveries;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}
