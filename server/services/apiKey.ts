/**
 * API Key Management Service
 * 
 * Handles API key generation, validation, and usage tracking.
 */

import { db } from "../db";
import { apiKeys, apiKeyUsageLogs } from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import * as crypto from 'crypto';

/**
 * Generate secure API key and secret
 */
function generateApiKey(): { apiKey: string; keySecret: string } {
  const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
  const keySecret = `sk_${crypto.randomBytes(32).toString('hex')}`;
  return { apiKey, keySecret };
}

/**
 * Create new API key
 */
export async function createApiKey(
  userId: number,
  keyName: string,
  options: {
    permissions?: string[];
    ipWhitelist?: string[];
    rateLimit?: number;
    expiresAt?: Date;
  } = {}
): Promise<{ id: number; apiKey: string; keySecret: string }> {
  try {
    const { apiKey, keySecret } = generateApiKey();

    const inserted = await db
      .insert(apiKeys)
      .values({
        keyName,
        apiKey,
        keySecret,
        userId,
        permissions: options.permissions || [],
        ipWhitelist: options.ipWhitelist || [],
        rateLimit: options.rateLimit || 1000,
        expiresAt: options.expiresAt,
        enabled: true,
      })
      .returning();

    return {
      id: inserted[0].id,
      apiKey,
      keySecret,
    };
  } catch (error) {
    console.error("Failed to create API key:", error);
    throw error;
  }
}

/**
 * Validate API key
 */
export async function validateApiKey(
  apiKey: string,
  ipAddress?: string
): Promise<{ valid: boolean; key?: any; reason?: string }> {
  try {
    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.apiKey, apiKey))
      .limit(1);

    if (keys.length === 0) {
      return { valid: false, reason: "Invalid API key" };
    }

    const key = keys[0];

    // Check if enabled
    if (!key.enabled) {
      return { valid: false, reason: "API key disabled" };
    }

    // Check if expired
    if (key.expiresAt && key.expiresAt < new Date()) {
      return { valid: false, reason: "API key expired" };
    }

    // Check IP whitelist
    if (ipAddress && key.ipWhitelist && key.ipWhitelist.length > 0) {
      const ipAllowed = key.ipWhitelist.some((allowedIp: string) => {
        // Simple IP matching (can be enhanced with CIDR support)
        return allowedIp === ipAddress || allowedIp === '*';
      });

      if (!ipAllowed) {
        return { valid: false, reason: "IP address not whitelisted" };
      }
    }

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(key.id, key.rateLimit, key.rateLimitWindow);
    if (!rateLimitCheck.allowed) {
      return { valid: false, reason: "Rate limit exceeded" };
    }

    // Update last used
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        requestCount: sql`${apiKeys.requestCount} + 1`,
      })
      .where(eq(apiKeys.id, key.id));

    return { valid: true, key };
  } catch (error) {
    console.error("Failed to validate API key:", error);
    return { valid: false, reason: "Validation error" };
  }
}

/**
 * Check rate limit
 */
async function checkRateLimit(
  keyId: number,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(apiKeyUsageLogs)
      .where(
        and(
          eq(apiKeyUsageLogs.apiKeyId, keyId),
          gte(apiKeyUsageLogs.createdAt, windowStart)
        )
      );

    const count = Number(result[0]?.count || 0);
    const remaining = Math.max(0, limit - count);

    return {
      allowed: count < limit,
      remaining,
    };
  } catch (error) {
    console.error("Failed to check rate limit:", error);
    return { allowed: true, remaining: limit };
  }
}

/**
 * Log API key usage
 */
export async function logApiKeyUsage(
  keyId: number,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await db.insert(apiKeyUsageLogs).values({
      apiKeyId: keyId,
      endpoint,
      method,
      ipAddress,
      userAgent,
      statusCode,
      responseTime,
      errorMessage,
    });
  } catch (error) {
    console.error("Failed to log API key usage:", error);
  }
}

/**
 * Get API keys for user
 */
export async function getUserApiKeys(userId: number): Promise<any[]> {
  try {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  } catch (error) {
    console.error("Failed to get user API keys:", error);
    return [];
  }
}

/**
 * Revoke API key
 */
export async function revokeApiKey(keyId: number): Promise<void> {
  try {
    await db
      .update(apiKeys)
      .set({ enabled: false })
      .where(eq(apiKeys.id, keyId));
  } catch (error) {
    console.error("Failed to revoke API key:", error);
    throw error;
  }
}

/**
 * Delete API key
 */
export async function deleteApiKey(keyId: number): Promise<void> {
  try {
    // Delete usage logs first
    await db.delete(apiKeyUsageLogs).where(eq(apiKeyUsageLogs.apiKeyId, keyId));

    // Delete API key
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  } catch (error) {
    console.error("Failed to delete API key:", error);
    throw error;
  }
}

/**
 * Get API key usage statistics
 */
export async function getApiKeyUsageStats(
  keyId: number,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  try {
    const conditions: any[] = [eq(apiKeyUsageLogs.apiKeyId, keyId)];

    if (startDate) {
      conditions.push(gte(apiKeyUsageLogs.createdAt, startDate));
    }

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        AVG(response_time) as avg_response_time,
        MAX(response_time) as max_response_time,
        MIN(response_time) as min_response_time
      FROM api_key_usage_logs
      WHERE ${sql.join(conditions, sql` AND `)}
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get API key usage stats:", error);
    return {};
  }
}

/**
 * Rotate API key secret
 */
export async function rotateApiKeySecret(keyId: number): Promise<string> {
  try {
    const { keySecret } = generateApiKey();

    await db
      .update(apiKeys)
      .set({ keySecret })
      .where(eq(apiKeys.id, keyId));

    return keySecret;
  } catch (error) {
    console.error("Failed to rotate API key secret:", error);
    throw error;
  }
}

/**
 * Check permission
 */
export function hasPermission(key: any, permission: string): boolean {
  if (!key.permissions || key.permissions.length === 0) {
    return true; // No restrictions
  }

  return key.permissions.includes(permission) || key.permissions.includes('*');
}
