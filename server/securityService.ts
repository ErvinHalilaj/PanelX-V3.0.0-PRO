/**
 * Advanced Security Service
 * Handles IP restrictions, device fingerprinting, rate limiting, and security monitoring
 */

import storage from './storage';

interface IpRestriction {
  id: string;
  userId: number;
  allowedIps: string[];
  deniedIps: string[];
  enabled: boolean;
  createdAt: Date;
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
  firstSeen: Date;
  lastSeen: Date;
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
  timestamp: Date;
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

class SecurityService {
  private ipRestrictions: Map<number, IpRestriction> = new Map();
  private deviceFingerprints: Map<string, DeviceFingerprint> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();
  private settings: SecuritySettings = {
    maxDevicesPerUser: 5,
    maxConcurrentConnections: 3,
    ipWhitelistEnabled: false,
    deviceFingerprintingEnabled: true,
    autoBlockSuspiciousActivity: true,
    sessionTimeout: 86400000, // 24 hours
    requireDeviceApproval: false,
  };

  constructor() {
    this.initializeDefaultRules();
    this.startCleanupInterval();
  }

  private initializeDefaultRules() {
    // Default rate limit rules
    this.rateLimitRules.set('login', {
      id: 'login',
      name: 'Login Rate Limit',
      endpoint: '/api/login',
      maxRequests: 5,
      windowSeconds: 300, // 5 minutes
      action: 'block',
      enabled: true,
    });

    this.rateLimitRules.set('api', {
      id: 'api',
      name: 'API Rate Limit',
      endpoint: '/api/*',
      maxRequests: 100,
      windowSeconds: 60, // 1 minute
      action: 'throttle',
      enabled: true,
    });

    this.rateLimitRules.set('streaming', {
      id: 'streaming',
      name: 'Streaming Rate Limit',
      endpoint: '/live/*',
      maxRequests: 10,
      windowSeconds: 10,
      action: 'alert',
      enabled: true,
    });
  }

  private startCleanupInterval() {
    // Cleanup old events every hour
    setInterval(() => {
      const oneDayAgo = Date.now() - 86400000;
      this.securityEvents = this.securityEvents.filter(
        event => event.timestamp.getTime() > oneDayAgo
      );
      
      // Cleanup old rate limit entries
      const now = Date.now();
      for (const [key, value] of this.rateLimitCache.entries()) {
        if (value.resetTime < now) {
          this.rateLimitCache.delete(key);
        }
      }
    }, 3600000); // 1 hour
  }

  // IP Restrictions
  async setIpRestrictions(userId: number, allowedIps: string[], deniedIps: string[]): Promise<IpRestriction> {
    const restriction: IpRestriction = {
      id: `ip_${userId}_${Date.now()}`,
      userId,
      allowedIps,
      deniedIps,
      enabled: true,
      createdAt: new Date(),
    };

    this.ipRestrictions.set(userId, restriction);
    return restriction;
  }

  async getIpRestrictions(userId: number): Promise<IpRestriction | null> {
    return this.ipRestrictions.get(userId) || null;
  }

  async checkIpAllowed(userId: number, ipAddress: string): Promise<boolean> {
    const restrictions = this.ipRestrictions.get(userId);
    if (!restrictions || !restrictions.enabled) return true;

    // Check denied IPs first
    if (restrictions.deniedIps.some(ip => this.matchIp(ipAddress, ip))) {
      await this.logSecurityEvent({
        userId,
        eventType: 'ip_blocked',
        severity: 'high',
        ipAddress,
        userAgent: '',
        details: { reason: 'IP in deny list' },
      });
      return false;
    }

    // If whitelist is enabled, check allowed IPs
    if (restrictions.allowedIps.length > 0) {
      const allowed = restrictions.allowedIps.some(ip => this.matchIp(ipAddress, ip));
      if (!allowed) {
        await this.logSecurityEvent({
          userId,
          eventType: 'ip_blocked',
          severity: 'medium',
          ipAddress,
          userAgent: '',
          details: { reason: 'IP not in whitelist' },
        });
      }
      return allowed;
    }

    return true;
  }

  private matchIp(ip: string, pattern: string): boolean {
    // Support CIDR notation and wildcards
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(ip);
    }
    
    if (pattern.includes('/')) {
      // CIDR notation support (simplified)
      const [network, bits] = pattern.split('/');
      const bitsNum = parseInt(bits);
      const networkParts = network.split('.').map(Number);
      const ipParts = ip.split('.').map(Number);
      
      let match = true;
      let remainingBits = bitsNum;
      for (let i = 0; i < 4 && remainingBits > 0; i++) {
        const mask = remainingBits >= 8 ? 255 : (255 << (8 - remainingBits)) & 255;
        if ((networkParts[i] & mask) !== (ipParts[i] & mask)) {
          match = false;
          break;
        }
        remainingBits -= 8;
      }
      return match;
    }

    return ip === pattern;
  }

  // Device Fingerprinting
  async registerDevice(
    userId: number,
    fingerprint: string,
    deviceInfo: DeviceFingerprint['deviceInfo']
  ): Promise<DeviceFingerprint> {
    const existing = this.deviceFingerprints.get(fingerprint);
    
    if (existing) {
      // Update existing device
      existing.lastSeen = new Date();
      existing.loginCount++;
      return existing;
    }

    // Create new device fingerprint
    const device: DeviceFingerprint = {
      id: `device_${Date.now()}`,
      userId,
      fingerprint,
      deviceInfo,
      firstSeen: new Date(),
      lastSeen: new Date(),
      trustLevel: 'trusted',
      loginCount: 1,
    };

    this.deviceFingerprints.set(fingerprint, device);
    
    // Check device limit
    const userDevices = this.getUserDevices(userId);
    if (userDevices.length > this.settings.maxDevicesPerUser) {
      device.trustLevel = 'suspicious';
      await this.logSecurityEvent({
        userId,
        eventType: 'suspicious_activity',
        severity: 'medium',
        ipAddress: '',
        userAgent: deviceInfo.userAgent,
        details: { reason: 'Too many devices registered', deviceCount: userDevices.length },
      });
    }

    return device;
  }

  getUserDevices(userId: number): DeviceFingerprint[] {
    return Array.from(this.deviceFingerprints.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  async updateDeviceTrustLevel(
    fingerprint: string,
    trustLevel: DeviceFingerprint['trustLevel']
  ): Promise<boolean> {
    const device = this.deviceFingerprints.get(fingerprint);
    if (!device) return false;

    device.trustLevel = trustLevel;
    
    if (trustLevel === 'blocked') {
      await this.logSecurityEvent({
        userId: device.userId,
        eventType: 'device_blocked',
        severity: 'high',
        ipAddress: '',
        userAgent: device.deviceInfo.userAgent,
        details: { fingerprint },
      });
    }

    return true;
  }

  async removeDevice(fingerprint: string): Promise<boolean> {
    return this.deviceFingerprints.delete(fingerprint);
  }

  // Rate Limiting
  async checkRateLimit(
    identifier: string,
    ruleId: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const rule = this.rateLimitRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const key = `${ruleId}:${identifier}`;
    const now = Date.now();
    const cached = this.rateLimitCache.get(key);

    if (!cached || cached.resetTime < now) {
      // New window
      const resetTime = now + (rule.windowSeconds * 1000);
      this.rateLimitCache.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: rule.maxRequests - 1,
        resetTime,
      };
    }

    // Increment counter
    cached.count++;
    
    const allowed = cached.count <= rule.maxRequests;
    const remaining = Math.max(0, rule.maxRequests - cached.count);

    if (!allowed && rule.action === 'block') {
      await this.logSecurityEvent({
        userId: 0,
        eventType: 'rate_limit_exceeded',
        severity: 'medium',
        ipAddress: identifier,
        userAgent: '',
        details: { rule: rule.name, count: cached.count, limit: rule.maxRequests },
      });
    }

    return {
      allowed,
      remaining,
      resetTime: cached.resetTime,
    };
  }

  // Security Events
  private async logSecurityEvent(
    event: Omit<SecurityEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.securityEvents.push(fullEvent);

    // Auto-block on critical events if enabled
    if (
      this.settings.autoBlockSuspiciousActivity &&
      fullEvent.severity === 'critical'
    ) {
      // Implement auto-blocking logic here
      console.log('[Security] Auto-blocking triggered:', fullEvent);
    }
  }

  async getSecurityEvents(
    userId?: number,
    severity?: SecurityEvent['severity'],
    limit = 100
  ): Promise<SecurityEvent[]> {
    let events = [...this.securityEvents];

    if (userId) {
      events = events.filter(e => e.userId === userId);
    }

    if (severity) {
      events = events.filter(e => e.severity === severity);
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Settings
  async updateSettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    this.settings = { ...this.settings, ...settings };
    return this.settings;
  }

  getSettings(): SecuritySettings {
    return { ...this.settings };
  }

  // Rate Limit Rules Management
  async createRateLimitRule(rule: Omit<RateLimitRule, 'id'>): Promise<RateLimitRule> {
    const id = `rule_${Date.now()}`;
    const fullRule = { ...rule, id };
    this.rateLimitRules.set(id, fullRule);
    return fullRule;
  }

  async updateRateLimitRule(id: string, updates: Partial<RateLimitRule>): Promise<RateLimitRule | null> {
    const rule = this.rateLimitRules.get(id);
    if (!rule) return null;

    const updated = { ...rule, ...updates };
    this.rateLimitRules.set(id, updated);
    return updated;
  }

  async deleteRateLimitRule(id: string): Promise<boolean> {
    return this.rateLimitRules.delete(id);
  }

  getRateLimitRules(): RateLimitRule[] {
    return Array.from(this.rateLimitRules.values());
  }

  // Security Statistics
  async getSecurityStats(): Promise<{
    totalEvents: number;
    eventsBySeverity: Record<string, number>;
    topThreats: Array<{ type: string; count: number }>;
    blockedIps: number;
    blockedDevices: number;
    activeRules: number;
  }> {
    const eventsBySeverity = this.securityEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByType = this.securityEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const blockedDevices = Array.from(this.deviceFingerprints.values())
      .filter(d => d.trustLevel === 'blocked').length;

    const activeRules = Array.from(this.rateLimitRules.values())
      .filter(r => r.enabled).length;

    return {
      totalEvents: this.securityEvents.length,
      eventsBySeverity,
      topThreats,
      blockedIps: 0, // Would need to track blocked IPs separately
      blockedDevices,
      activeRules,
    };
  }
}

export const securityService = new SecurityService();
