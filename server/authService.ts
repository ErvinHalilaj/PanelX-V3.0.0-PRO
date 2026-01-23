/**
 * Enhanced Authentication Service
 * Handles 2FA, API keys, session management, and advanced authentication
 */

import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { storage } from './storage';

interface ApiKey {
  id: string;
  userId: number;
  key: string;
  name: string;
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

interface Session {
  id: string;
  userId: number;
  token: string;
  ipAddress: string;
  userAgent: string;
  lastActive: Date;
  expiresAt: Date;
  createdAt: Date;
}

interface TwoFactorAuth {
  userId: number;
  secret: string;
  enabled: boolean;
  backupCodes: string[];
}

interface LoginAttempt {
  ip: string;
  username: string;
  success: boolean;
  timestamp: Date;
}

class AuthService {
  private sessions: Map<string, Session> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private twoFactorSecrets: Map<number, TwoFactorAuth> = new Map();
  private loginAttempts: LoginAttempt[] = [];
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private maxLoginAttempts = 5;
  private loginAttemptWindow = 15 * 60 * 1000; // 15 minutes

  /**
   * Generate secure random token
   */
  private generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create new session
   */
  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<{ sessionId: string; token: string }> {
    const sessionId = this.generateToken(16);
    const token = this.generateToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: Session = {
      id: sessionId,
      userId,
      token,
      ipAddress,
      userAgent,
      lastActive: now,
      expiresAt,
      createdAt: now,
    };

    this.sessions.set(sessionId, session);

    // Cleanup old sessions for this user (keep last 5)
    await this.cleanupUserSessions(userId, 5);

    return { sessionId, token };
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string, token: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Check token match
    if (session.token !== token) return null;

    // Update last active
    session.lastActive = new Date();

    return session;
  }

  /**
   * Refresh session (extend expiration)
   */
  async refreshSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const now = new Date();
    session.expiresAt = new Date(now.getTime() + this.sessionTimeout);
    session.lastActive = now;

    return true;
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions for user
   */
  async getUserSessions(userId: number): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );
    return sessions.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
  }

  /**
   * Cleanup old sessions for user
   */
  private async cleanupUserSessions(userId: number, keepLast: number = 5): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length > keepLast) {
      const toDelete = sessions.slice(keepLast);
      toDelete.forEach((session) => this.sessions.delete(session.id));
    }
  }

  /**
   * Generate 2FA secret
   */
  async generate2FASecret(userId: number, username: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    // Generate secret
    const secret = new OTPAuth.Secret({ size: 20 });
    
    // Create TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'PanelX',
      label: username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      this.generateToken(4).toUpperCase()
    );

    // Store (not enabled yet)
    this.twoFactorSecrets.set(userId, {
      userId,
      secret: secret.base32,
      enabled: false,
      backupCodes,
    });

    return {
      secret: secret.base32,
      qrCodeUrl: totp.toString(),
      backupCodes,
    };
  }

  /**
   * Enable 2FA
   */
  async enable2FA(userId: number, token: string): Promise<boolean> {
    const twoFA = this.twoFactorSecrets.get(userId);
    if (!twoFA) return false;

    // Verify token
    const isValid = await this.verify2FAToken(userId, token);
    if (!isValid) return false;

    // Enable
    twoFA.enabled = true;

    // Update user in database
    const user = await storage.getUser(userId);
    if (user) {
      await storage.updateUser(userId, {
        ...user,
        twoFactorEnabled: true,
        twoFactorSecret: twoFA.secret,
      });
    }

    return true;
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: number): Promise<boolean> {
    const twoFA = this.twoFactorSecrets.get(userId);
    if (!twoFA) return false;

    twoFA.enabled = false;
    this.twoFactorSecrets.delete(userId);

    // Update user in database
    const user = await storage.getUser(userId);
    if (user) {
      await storage.updateUser(userId, {
        ...user,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
    }

    return true;
  }

  /**
   * Verify 2FA token
   */
  async verify2FAToken(userId: number, token: string): Promise<boolean> {
    const twoFA = this.twoFactorSecrets.get(userId);
    if (!twoFA) {
      // Try loading from database
      const user = await storage.getUser(userId);
      if (!user || !user.twoFactorSecret) return false;
      
      this.twoFactorSecrets.set(userId, {
        userId,
        secret: user.twoFactorSecret,
        enabled: user.twoFactorEnabled || false,
        backupCodes: [],
      });

      return this.verify2FAToken(userId, token);
    }

    // Check backup codes first
    const backupIndex = twoFA.backupCodes.indexOf(token);
    if (backupIndex !== -1) {
      // Remove used backup code
      twoFA.backupCodes.splice(backupIndex, 1);
      return true;
    }

    // Verify TOTP token
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(twoFA.secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }

  /**
   * Create API key
   */
  async createApiKey(
    userId: number,
    name: string,
    permissions: string[] = [],
    expiresInDays?: number
  ): Promise<{ key: string; id: string }> {
    const id = this.generateToken(8);
    const key = `pk_${this.generateToken(32)}`;
    const hashedKey = this.hashApiKey(key);
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey: ApiKey = {
      id,
      userId,
      key: hashedKey,
      name,
      permissions,
      expiresAt,
      createdAt: now,
    };

    this.apiKeys.set(hashedKey, apiKey);

    return { key, id };
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    const hashedKey = this.hashApiKey(key);
    const apiKey = this.apiKeys.get(hashedKey);
    
    if (!apiKey) return null;

    // Check if expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      this.apiKeys.delete(hashedKey);
      return null;
    }

    // Update last used
    apiKey.lastUsed = new Date();

    return apiKey;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: number, keyId: string): Promise<boolean> {
    for (const [hashedKey, apiKey] of this.apiKeys.entries()) {
      if (apiKey.id === keyId && apiKey.userId === userId) {
        this.apiKeys.delete(hashedKey);
        return true;
      }
    }
    return false;
  }

  /**
   * List user API keys
   */
  async listApiKeys(userId: number): Promise<Omit<ApiKey, 'key'>[]> {
    const keys = Array.from(this.apiKeys.values())
      .filter((k) => k.userId === userId)
      .map(({ key, ...rest }) => rest);

    return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check if API key has permission
   */
  hasPermission(apiKey: ApiKey, permission: string): boolean {
    if (apiKey.permissions.includes('*')) return true;
    return apiKey.permissions.includes(permission);
  }

  /**
   * Record login attempt
   */
  recordLoginAttempt(ip: string, username: string, success: boolean): void {
    this.loginAttempts.push({
      ip,
      username,
      success,
      timestamp: new Date(),
    });

    // Cleanup old attempts (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.loginAttempts = this.loginAttempts.filter(
      (attempt) => attempt.timestamp > oneHourAgo
    );
  }

  /**
   * Check if IP is rate limited
   */
  isRateLimited(ip: string): boolean {
    const windowStart = new Date(Date.now() - this.loginAttemptWindow);
    const recentAttempts = this.loginAttempts.filter(
      (attempt) =>
        attempt.ip === ip &&
        !attempt.success &&
        attempt.timestamp > windowStart
    );

    return recentAttempts.length >= this.maxLoginAttempts;
  }

  /**
   * Get failed login attempts for IP
   */
  getFailedAttempts(ip: string): number {
    const windowStart = new Date(Date.now() - this.loginAttemptWindow);
    return this.loginAttempts.filter(
      (attempt) =>
        attempt.ip === ip &&
        !attempt.success &&
        attempt.timestamp > windowStart
    ).length;
  }

  /**
   * Clear failed attempts for IP
   */
  clearFailedAttempts(ip: string): void {
    this.loginAttempts = this.loginAttempts.filter(
      (attempt) => attempt.ip !== ip || attempt.success
    );
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    return count;
  }

  /**
   * Cleanup expired API keys
   */
  async cleanupExpiredApiKeys(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [hashedKey, apiKey] of this.apiKeys.entries()) {
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        this.apiKeys.delete(hashedKey);
        count++;
      }
    }

    return count;
  }
}

// Singleton instance
export const authService = new AuthService();

// Periodic cleanup (every hour)
setInterval(() => {
  authService.cleanupExpiredSessions();
  authService.cleanupExpiredApiKeys();
}, 60 * 60 * 1000);
