import { db } from "../db";
import { embeddedLines, lines } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function generateEmbedToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createEmbeddedLine(data: {
  lineId: number;
  allowedDomains?: string[];
  allowedIps?: string[];
  customPlayerUrl?: string;
  playerSettings?: Record<string, any>;
  expiresAt?: Date;
}) {
  const existingLine = await db.select().from(lines).where(eq(lines.id, data.lineId)).limit(1);
  if (existingLine.length === 0) {
    throw new Error('Line not found');
  }
  
  const existing = await db.select().from(embeddedLines)
    .where(eq(embeddedLines.lineId, data.lineId))
    .limit(1);
  
  if (existing.length > 0) {
    const [updated] = await db.update(embeddedLines)
      .set({
        allowedDomains: data.allowedDomains || [],
        allowedIps: data.allowedIps || [],
        customPlayerUrl: data.customPlayerUrl,
        playerSettings: data.playerSettings || {},
        expiresAt: data.expiresAt,
        enabled: true,
      })
      .where(eq(embeddedLines.id, existing[0].id))
      .returning();
    return updated;
  }
  
  const [created] = await db.insert(embeddedLines).values({
    lineId: data.lineId,
    embedToken: generateEmbedToken(),
    allowedDomains: data.allowedDomains || [],
    allowedIps: data.allowedIps || [],
    customPlayerUrl: data.customPlayerUrl,
    playerSettings: data.playerSettings || {},
    expiresAt: data.expiresAt,
    enabled: true,
  }).returning();
  
  return created;
}

export async function getEmbeddedLine(id: number) {
  const [embedded] = await db.select().from(embeddedLines).where(eq(embeddedLines.id, id));
  return embedded;
}

export async function getEmbeddedLineByToken(token: string) {
  const [embedded] = await db.select().from(embeddedLines)
    .where(and(
      eq(embeddedLines.embedToken, token),
      eq(embeddedLines.enabled, true)
    ));
  return embedded;
}

export async function getEmbeddedLineByLineId(lineId: number) {
  const [embedded] = await db.select().from(embeddedLines)
    .where(eq(embeddedLines.lineId, lineId));
  return embedded;
}

export async function getAllEmbeddedLines() {
  return await db.select().from(embeddedLines);
}

export async function updateEmbeddedLine(id: number, data: Partial<typeof embeddedLines.$inferInsert>) {
  const [updated] = await db.update(embeddedLines)
    .set(data)
    .where(eq(embeddedLines.id, id))
    .returning();
  return updated;
}

export async function deleteEmbeddedLine(id: number) {
  await db.delete(embeddedLines).where(eq(embeddedLines.id, id));
}

export async function regenerateToken(id: number) {
  const [updated] = await db.update(embeddedLines)
    .set({ embedToken: generateEmbedToken() })
    .where(eq(embeddedLines.id, id))
    .returning();
  return updated;
}

export async function recordEmbedView(token: string) {
  const embedded = await getEmbeddedLineByToken(token);
  if (!embedded) return null;
  
  await db.update(embeddedLines)
    .set({
      embedViews: (embedded.embedViews || 0) + 1,
      lastUsed: new Date(),
    })
    .where(eq(embeddedLines.id, embedded.id));
  
  return embedded;
}

export async function validateEmbedAccess(token: string, domain?: string, ip?: string): Promise<{
  valid: boolean;
  line?: typeof lines.$inferSelect;
  reason?: string;
}> {
  const embedded = await getEmbeddedLineByToken(token);
  
  if (!embedded) {
    return { valid: false, reason: 'Invalid embed token' };
  }
  
  if (!embedded.enabled) {
    return { valid: false, reason: 'Embed access disabled' };
  }
  
  if (embedded.expiresAt && new Date(embedded.expiresAt) < new Date()) {
    return { valid: false, reason: 'Embed token expired' };
  }
  
  const allowedDomains = (embedded.allowedDomains as string[]) || [];
  if (allowedDomains.length > 0) {
    if (!domain) {
      return { valid: false, reason: 'Domain header required for this embed token' };
    }
    
    let parsedDomain: string;
    try {
      parsedDomain = domain.includes('://') ? new URL(domain).hostname : domain;
    } catch {
      return { valid: false, reason: 'Invalid domain format' };
    }
    
    const domainMatch = allowedDomains.some(d => {
      if (d.startsWith('*.')) {
        return parsedDomain.endsWith(d.substring(1)) || parsedDomain === d.substring(2);
      }
      return parsedDomain === d || parsedDomain.endsWith('.' + d);
    });
    
    if (!domainMatch) {
      return { valid: false, reason: 'Domain not allowed' };
    }
  }
  
  const allowedIps = (embedded.allowedIps as string[]) || [];
  if (allowedIps.length > 0 && ip) {
    if (!allowedIps.includes(ip)) {
      return { valid: false, reason: 'IP not allowed' };
    }
  }
  
  const [line] = await db.select().from(lines).where(eq(lines.id, embedded.lineId));
  
  if (!line) {
    return { valid: false, reason: 'Associated line not found' };
  }
  
  if (!line.enabled || !line.adminEnabled) {
    return { valid: false, reason: 'Line disabled' };
  }
  
  if (line.expDate && new Date(line.expDate) < new Date()) {
    return { valid: false, reason: 'Line expired' };
  }
  
  await recordEmbedView(token);
  
  return { valid: true, line };
}

export async function getEmbedPlayerUrl(token: string, streamId: number, format = 'm3u8'): Promise<string | null> {
  const validation = await validateEmbedAccess(token);
  if (!validation.valid || !validation.line) return null;
  
  const line = validation.line;
  return `/live/${line.username}/${line.password}/${streamId}.${format}`;
}

export async function getEmbedPlaylist(token: string): Promise<string | null> {
  const validation = await validateEmbedAccess(token);
  if (!validation.valid || !validation.line) return null;
  
  const line = validation.line;
  return `/get.php?username=${line.username}&password=${line.password}&type=m3u_plus&output=ts`;
}
