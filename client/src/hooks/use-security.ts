import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface IpRestriction {
  id: string;
  userId: number;
  allowedIps: string[];
  deniedIps: string[];
  enabled: boolean;
  createdAt: string;
}

interface DeviceFingerprint {
  id: string;
  userId: number;
  fingerprint: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    timezone: string;
    language: string;
  };
  firstSeen: string;
  lastSeen: string;
  trustLevel: 'trusted' | 'suspicious' | 'blocked';
  loginCount: number;
}

interface SecurityEvent {
  id: string;
  userId: number;
  eventType: 'login_attempt' | 'failed_login' | 'ip_blocked' | 'device_blocked' | 'suspicious_activity' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: string;
}

interface RateLimitRule {
  id: string;
  name: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  action: 'throttle' | 'block' | 'alert';
  enabled: boolean;
}

interface SecuritySettings {
  maxDevicesPerUser: number;
  maxConcurrentConnections: number;
  ipWhitelistEnabled: boolean;
  deviceFingerprintingEnabled: boolean;
  autoBlockSuspiciousActivity: boolean;
  sessionTimeout: number;
  requireDeviceApproval: boolean;
}

interface SecurityStats {
  totalEvents: number;
  eventsBySeverity: Record<string, number>;
  topThreats: Array<{ type: string; count: number }>;
  blockedIps: number;
  blockedDevices: number;
  activeRules: number;
}

/**
 * Get IP restrictions for a user
 */
export function useIpRestrictions(userId: number) {
  return useQuery({
    queryKey: ['ipRestrictions', userId],
    queryFn: async () => {
      const { data } = await axios.get<IpRestriction>(`/api/security/ip-restrictions/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Set IP restrictions
 */
export function useSetIpRestrictions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: number; allowedIps: string[]; deniedIps: string[] }) => {
      const { data } = await axios.post<IpRestriction>('/api/security/ip-restrictions', params);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ipRestrictions', variables.userId] });
    },
  });
}

/**
 * Get user devices
 */
export function useUserDevices(userId: number) {
  return useQuery({
    queryKey: ['userDevices', userId],
    queryFn: async () => {
      const { data } = await axios.get<{ devices: DeviceFingerprint[] }>(`/api/security/devices/${userId}`);
      return data.devices;
    },
    enabled: !!userId,
  });
}

/**
 * Register device
 */
export function useRegisterDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: number;
      fingerprint: string;
      deviceInfo: DeviceFingerprint['deviceInfo'];
    }) => {
      const { data } = await axios.post<DeviceFingerprint>('/api/security/devices/register', params);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userDevices', variables.userId] });
    },
  });
}

/**
 * Update device trust level
 */
export function useUpdateDeviceTrust() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { fingerprint: string; trustLevel: DeviceFingerprint['trustLevel'] }) => {
      const { data } = await axios.put(`/api/security/devices/${params.fingerprint}/trust`, {
        trustLevel: params.trustLevel,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDevices'] });
    },
  });
}

/**
 * Remove device
 */
export function useRemoveDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fingerprint: string) => {
      const { data } = await axios.delete(`/api/security/devices/${fingerprint}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDevices'] });
    },
  });
}

/**
 * Get security events
 */
export function useSecurityEvents(userId?: number, severity?: SecurityEvent['severity'], limit = 100) {
  return useQuery({
    queryKey: ['securityEvents', userId, severity, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (severity) params.append('severity', severity);
      if (limit) params.append('limit', limit.toString());

      const { data } = await axios.get<{ events: SecurityEvent[] }>(`/api/security/events?${params}`);
      return data.events;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get security stats
 */
export function useSecurityStats() {
  return useQuery({
    queryKey: ['securityStats'],
    queryFn: async () => {
      const { data } = await axios.get<SecurityStats>('/api/security/stats');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get security settings
 */
export function useSecuritySettings() {
  return useQuery({
    queryKey: ['securitySettings'],
    queryFn: async () => {
      const { data } = await axios.get<SecuritySettings>('/api/security/settings');
      return data;
    },
  });
}

/**
 * Update security settings
 */
export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<SecuritySettings>) => {
      const { data } = await axios.put<SecuritySettings>('/api/security/settings', settings);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securitySettings'] });
    },
  });
}

/**
 * Get rate limit rules
 */
export function useRateLimitRules() {
  return useQuery({
    queryKey: ['rateLimitRules'],
    queryFn: async () => {
      const { data } = await axios.get<{ rules: RateLimitRule[] }>('/api/security/rate-limits');
      return data.rules;
    },
  });
}

/**
 * Create rate limit rule
 */
export function useCreateRateLimitRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<RateLimitRule, 'id'>) => {
      const { data } = await axios.post<RateLimitRule>('/api/security/rate-limits', rule);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
    },
  });
}

/**
 * Update rate limit rule
 */
export function useUpdateRateLimitRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<RateLimitRule> }) => {
      const { data } = await axios.put<RateLimitRule>(`/api/security/rate-limits/${params.id}`, params.updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
    },
  });
}

/**
 * Delete rate limit rule
 */
export function useDeleteRateLimitRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/security/rate-limits/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
    },
  });
}
