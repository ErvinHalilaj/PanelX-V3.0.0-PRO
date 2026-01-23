import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Session {
  id: string;
  userId: number;
  ipAddress: string;
  userAgent: string;
  lastActive: string;
  expiresAt: string;
  createdAt: string;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface ApiKey {
  id: string;
  userId: number;
  name: string;
  permissions: string[];
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
}

/**
 * Get user sessions
 */
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await axios.get<{ sessions: Session[] }>('/api/auth/sessions');
      return data.sessions;
    },
  });
}

/**
 * Destroy session
 */
export function useDestroySession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await axios.delete(`/api/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

/**
 * Generate 2FA secret
 */
export function useGenerate2FA() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<TwoFactorSetup>('/api/auth/2fa/generate');
      return data;
    },
  });
}

/**
 * Enable 2FA
 */
export function useEnable2FA() {
  return useMutation({
    mutationFn: async (token: string) => {
      await axios.post('/api/auth/2fa/enable', { token });
    },
  });
}

/**
 * Disable 2FA
 */
export function useDisable2FA() {
  return useMutation({
    mutationFn: async () => {
      await axios.post('/api/auth/2fa/disable');
    },
  });
}

/**
 * Verify 2FA token
 */
export function useVerify2FA() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await axios.post<{ valid: boolean }>('/api/auth/2fa/verify', { token });
      return data.valid;
    },
  });
}

/**
 * Get API keys
 */
export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const { data } = await axios.get<{ keys: ApiKey[] }>('/api/auth/api-keys');
      return data.keys;
    },
  });
}

/**
 * Create API key
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      permissions?: string[];
      expiresInDays?: number;
    }) => {
      const { data } = await axios.post<{ key: string; id: string }>(
        '/api/auth/api-keys',
        params
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

/**
 * Revoke API key
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      await axios.delete(`/api/auth/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}
