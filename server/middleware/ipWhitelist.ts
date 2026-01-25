import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { ipWhitelist } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Check if an IP address matches an IP range in CIDR notation
 * @param ip - IP address to check
 * @param range - CIDR range (e.g., "192.168.1.0/24")
 * @returns True if IP is in range
 */
function ipInRange(ip: string, range: string): boolean {
  if (!range.includes('/')) {
    return ip === range;
  }

  const [rangeIp, bits] = range.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  const rangeNum = rangeIp.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Middleware to enforce IP whitelisting
 * Only allows requests from whitelisted IPs
 */
export async function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Get client IP
    const clientIP = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
    
    // Skip check for localhost in development
    if (process.env.NODE_ENV === 'development' && (clientIP === '127.0.0.1' || clientIP === '::1')) {
      return next();
    }

    // Get user role if authenticated
    const userRole = req.session?.role;
    const userId = req.session?.userId;

    // Get all active whitelist rules
    const rules = await db.select()
      .from(ipWhitelist)
      .where(eq(ipWhitelist.isActive, true));

    // If no rules exist, allow all (whitelisting is disabled)
    if (rules.length === 0) {
      return next();
    }

    // Check global rules first
    const globalRules = rules.filter(rule => rule.isGlobal);
    for (const rule of globalRules) {
      // Check role permissions
      if (userRole === 'admin' && !rule.allowAdmin) continue;
      if (userRole === 'reseller' && !rule.allowReseller) continue;

      // Check IP match
      if (rule.ipAddress === clientIP) {
        // Update last used
        await db.update(ipWhitelist)
          .set({ lastUsed: new Date() })
          .where(eq(ipWhitelist.id, rule.id));
        return next();
      }

      // Check IP range match
      if (rule.ipRange && ipInRange(clientIP, rule.ipRange)) {
        await db.update(ipWhitelist)
          .set({ lastUsed: new Date() })
          .where(eq(ipWhitelist.id, rule.id));
        return next();
      }
    }

    // Check user-specific rules if authenticated
    if (userId) {
      const userRules = rules.filter(rule => rule.userId === userId);
      for (const rule of userRules) {
        if (rule.ipAddress === clientIP) {
          await db.update(ipWhitelist)
            .set({ lastUsed: new Date() })
            .where(eq(ipWhitelist.id, rule.id));
          return next();
        }

        if (rule.ipRange && ipInRange(clientIP, rule.ipRange)) {
          await db.update(ipWhitelist)
            .set({ lastUsed: new Date() })
            .where(eq(ipWhitelist.id, rule.id));
          return next();
        }
      }
    }

    // IP not whitelisted - deny access
    return res.status(403).json({ 
      message: 'Access denied: IP address not whitelisted',
      ip: clientIP 
    });

  } catch (error) {
    console.error('IP whitelist middleware error:', error);
    // On error, allow access to prevent lockout
    return next();
  }
}

/**
 * Middleware to log IP access attempts (for monitoring)
 */
export function logIpAccess(req: Request, res: Response, next: NextFunction) {
  const clientIP = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
  const path = req.path;
  const method = req.method;
  const userId = req.session?.userId;

  console.log(`[IP Access] ${method} ${path} from ${clientIP} (User: ${userId || 'anonymous'})`);
  next();
}
