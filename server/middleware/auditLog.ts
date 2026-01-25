import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '@shared/schema';

// Actions that should be logged
const LOGGABLE_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'ENABLE_2FA', 'DISABLE_2FA',
  'BULK_OPERATION', 'IMPORT', 'EXPORT',
  'START_STREAM', 'STOP_STREAM', 'RESTART_STREAM'
];

// Sensitive fields to redact from logs
const SENSITIVE_FIELDS = ['password', 'secret', 'token', 'apiKey', 'backupCodes'];

/**
 * Redact sensitive fields from an object
 */
function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in redacted) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  
  return redacted;
}

/**
 * Extract resource information from request path
 */
function extractResourceInfo(path: string, method: string): { resource: string; resourceId?: number } {
  const segments = path.split('/').filter(Boolean);
  
  // API paths usually follow /api/{resource}/{id}
  if (segments[0] === 'api' && segments.length >= 2) {
    const resource = segments[1];
    const potentialId = segments[2] ? parseInt(segments[2]) : undefined;
    
    return {
      resource,
      resourceId: isNaN(potentialId!) ? undefined : potentialId
    };
  }
  
  return { resource: 'unknown' };
}

/**
 * Determine action from HTTP method and path
 */
function determineAction(method: string, path: string): string {
  if (path.includes('/login')) return 'LOGIN';
  if (path.includes('/logout')) return 'LOGOUT';
  if (path.includes('/2fa/enable')) return 'ENABLE_2FA';
  if (path.includes('/2fa/disable')) return 'DISABLE_2FA';
  if (path.includes('/start')) return 'START_STREAM';
  if (path.includes('/stop')) return 'STOP_STREAM';
  if (path.includes('/restart')) return 'RESTART_STREAM';
  if (path.includes('/bulk')) return 'BULK_OPERATION';
  if (path.includes('/import')) return 'IMPORT';
  if (path.includes('/export')) return 'EXPORT';
  
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    case 'GET': return 'READ';
    default: return method;
  }
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userId: number | null,
  username: string | null,
  action: string,
  resource: string,
  resourceId: number | null,
  metadata?: any,
  req?: Request,
  res?: Response,
  duration?: number
) {
  try {
    const ipAddress = req ? (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '') : null;
    const userAgent = req?.get('user-agent') || null;
    
    await db.insert(auditLogs).values({
      userId: userId,
      username: username,
      action,
      resource,
      resourceId: resourceId,
      method: req?.method || null,
      path: req?.path || null,
      ipAddress,
      userAgent,
      requestBody: req ? redactSensitiveData(req.body) : null,
      responseStatus: res?.statusCode || null,
      errorMessage: null,
      duration: duration || null,
      metadata: metadata || null,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - logging failure shouldn't break the app
  }
}

/**
 * Middleware to automatically log API requests
 */
export function auditLogMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip logging for certain paths (like static files, health checks)
  const skipPaths = ['/assets', '/favicon', '/health', '/ping'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Only log API requests
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const startTime = Date.now();
  
  // Capture response
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  let responseLogged = false;
  
  const logResponse = async () => {
    if (responseLogged) return;
    responseLogged = true;
    
    const duration = Date.now() - startTime;
    const action = determineAction(req.method, req.path);
    const { resource, resourceId } = extractResourceInfo(req.path, req.method);
    
    // Only log if it's a loggable action
    if (LOGGABLE_ACTIONS.includes(action) || req.method !== 'GET') {
      await logAuditEvent(
        req.session?.userId || null,
        req.session?.username || null,
        action,
        resource,
        resourceId || null,
        null,
        req,
        res,
        duration
      );
    }
  };
  
  res.json = function(body: any) {
    logResponse();
    return originalJson(body);
  };
  
  res.send = function(body: any) {
    logResponse();
    return originalSend(body);
  };
  
  next();
}

/**
 * Helper to log authentication failures
 */
export async function logAuthFailure(username: string, ipAddress: string, reason: string) {
  try {
    await db.insert(auditLogs).values({
      userId: null,
      username,
      action: 'LOGIN_FAILED',
      resource: 'auth',
      resourceId: null,
      method: 'POST',
      path: '/api/auth/login',
      ipAddress,
      userAgent: null,
      requestBody: null,
      responseStatus: 401,
      errorMessage: reason,
      duration: null,
      metadata: { reason },
    });
  } catch (error) {
    console.error('Failed to log auth failure:', error);
  }
}
