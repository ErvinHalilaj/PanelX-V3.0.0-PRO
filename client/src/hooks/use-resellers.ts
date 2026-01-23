import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Reseller {
  id: number;
  username: string;
  email: string;
  credits: number;
  maxCredits: number;
  parentResellerId?: number;
  permissions: Array<{
    resource: string;
    actions: string[];
  }>;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  enabled: boolean;
}

interface ResellerStats {
  totalUsers: number;
  activeUsers: number;
  totalLines: number;
  activeLines: number;
  totalStreams: number;
  creditsUsed: number;
  creditsRemaining: number;
  revenue: number;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

/**
 * Get resellers
 */
export function useResellers(parentId?: number) {
  return useQuery({
    queryKey: ['resellers', parentId],
    queryFn: async () => {
      const params = parentId ? `?parentId=${parentId}` : '';
      const { data } = await axios.get<{ resellers: Reseller[] }>(`/api/resellers${params}`);
      return data.resellers;
    },
  });
}

/**
 * Get reseller by ID
 */
export function useReseller(id: number) {
  return useQuery({
    queryKey: ['reseller', id],
    queryFn: async () => {
      const { data } = await axios.get<Reseller>(`/api/resellers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create reseller
 */
export function useCreateReseller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      username: string;
      email: string;
      password: string;
      initialCredits?: number;
      maxCredits?: number;
      parentResellerId?: number;
    }) => {
      const { data } = await axios.post<Reseller>('/api/resellers', params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
    },
  });
}

/**
 * Update reseller
 */
export function useUpdateReseller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Reseller> }) => {
      const { data } = await axios.put<Reseller>(`/api/resellers/${id}`, updates);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
    },
  });
}

/**
 * Add credits
 */
export function useAddCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: number;
      amount: number;
      reason?: string;
      referenceId?: string;
    }) => {
      const { data } = await axios.post<{ success: boolean; newBalance: number }>(
        `/api/resellers/${params.id}/credits/add`,
        { amount: params.amount, reason: params.reason, referenceId: params.referenceId }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['resellerStats', variables.id] });
    },
  });
}

/**
 * Deduct credits
 */
export function useDeductCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: number;
      amount: number;
      reason?: string;
      referenceId?: string;
    }) => {
      const { data } = await axios.post<{ success: boolean; newBalance: number }>(
        `/api/resellers/${params.id}/credits/deduct`,
        { amount: params.amount, reason: params.reason, referenceId: params.referenceId }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['resellerStats', variables.id] });
    },
  });
}

/**
 * Transfer credits
 */
export function useTransferCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      fromResellerId: number;
      toResellerId: number;
      amount: number;
      reason?: string;
    }) => {
      const { data } = await axios.post<{ success: boolean; fromBalance: number; toBalance: number }>(
        '/api/resellers/credits/transfer',
        params
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.fromResellerId] });
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.toResellerId] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
    },
  });
}

/**
 * Get credit packages
 */
export function useCreditPackages() {
  return useQuery({
    queryKey: ['creditPackages'],
    queryFn: async () => {
      const { data } = await axios.get<{ packages: CreditPackage[] }>('/api/resellers/packages');
      return data.packages;
    },
  });
}

/**
 * Purchase package
 */
export function usePurchasePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      resellerId: number;
      packageId: string;
      paymentReference: string;
    }) => {
      const { data } = await axios.post<{ success: boolean; newBalance: number }>(
        `/api/resellers/${params.resellerId}/packages/${params.packageId}/purchase`,
        { paymentReference: params.paymentReference }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reseller', variables.resellerId] });
      queryClient.invalidateQueries({ queryKey: ['resellerStats', variables.resellerId] });
    },
  });
}

/**
 * Get reseller stats
 */
export function useResellerStats(id: number) {
  return useQuery({
    queryKey: ['resellerStats', id],
    queryFn: async () => {
      const { data } = await axios.get<ResellerStats>(`/api/resellers/${id}/stats`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get reseller hierarchy
 */
export function useResellerHierarchy(id: number) {
  return useQuery({
    queryKey: ['resellerHierarchy', id],
    queryFn: async () => {
      const { data } = await axios.get<{
        parent: Reseller | null;
        children: Reseller[];
      }>(`/api/resellers/${id}/hierarchy`);
      return data;
    },
    enabled: !!id,
  });
}
