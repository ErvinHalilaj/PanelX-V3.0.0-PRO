import { db } from "../db";
import { vpnDetectionSettings, vpnIpCache, vpnDetectionLogs, vpnIpRanges } from "@shared/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";

interface VpnCheckResult {
  isVpn: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  isTor: boolean;
  blocked: boolean;
  riskScore: number;
  isp?: string;
  org?: string;
  country?: string;
  source: string;
}

const KNOWN_DATACENTER_ASNS = [
  'AS16509', 'AS14618', // Amazon AWS
  'AS15169', 'AS396982', // Google Cloud
  'AS8075', // Microsoft Azure
  'AS14061', // DigitalOcean
  'AS20473', // Vultr
  'AS63949', // Linode
  'AS46652', // ServerMania
  'AS62567', // DigitalOcean
  'AS13335', // Cloudflare
  'AS16276', // OVH
  'AS24940', // Hetzner
  'AS51167', // Contabo
  'AS9009', // M247
  'AS60068', // CDN77
  'AS397423', // Tier.Net
  'AS36352', // ColoCrossing
];

const KNOWN_VPN_PATTERNS = [
  /nordvpn/i, /expressvpn/i, /surfshark/i, /cyberghost/i, /pia/i,
  /private.internet/i, /mullvad/i, /protonvpn/i, /windscribe/i,
  /ipvanish/i, /hidemyass/i, /purevpn/i, /tunnelbear/i, /hotspot.shield/i,
  /avast.vpn/i, /norton.vpn/i, /kaspersky/i, /bitdefender/i,
];

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function isIpInRange(ip: string, startIp: string, endIp: string): boolean {
  const ipLong = ipToLong(ip);
  const startLong = ipToLong(startIp);
  const endLong = ipToLong(endIp);
  return ipLong >= startLong && ipLong <= endLong;
}

function cidrToRange(cidr: string): { start: string; end: string } | null {
  const match = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!match) return null;
  
  const ip = match[1];
  const bits = parseInt(match[2]);
  const ipLong = ipToLong(ip);
  const mask = ~((1 << (32 - bits)) - 1) >>> 0;
  const network = ipLong & mask;
  const broadcast = network + ((1 << (32 - bits)) - 1);
  
  const longToIp = (long: number): string => {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255
    ].join('.');
  };
  
  return { start: longToIp(network), end: longToIp(broadcast) };
}

async function getSettings() {
  const settings = await db.select().from(vpnDetectionSettings).limit(1);
  if (settings.length === 0) {
    const defaultSettings = {
      enabled: true,
      blockVpn: true,
      blockProxy: true,
      blockDatacenter: true,
      blockTor: true,
      whitelistIps: [],
      logDetections: true,
      apiProvider: 'local' as const,
      cacheHours: 24,
    };
    const [created] = await db.insert(vpnDetectionSettings).values(defaultSettings).returning();
    return created;
  }
  return settings[0];
}

async function checkLocalDatabase(ip: string): Promise<VpnCheckResult | null> {
  const ranges = await db.select().from(vpnIpRanges).where(eq(vpnIpRanges.enabled, true));
  
  for (const range of ranges) {
    let inRange = false;
    
    if (range.cidr) {
      const rangeData = cidrToRange(range.cidr);
      if (rangeData) {
        inRange = isIpInRange(ip, rangeData.start, rangeData.end);
      }
    } else if (range.startIp && range.endIp) {
      inRange = isIpInRange(ip, range.startIp, range.endIp);
    }
    
    if (inRange) {
      return {
        isVpn: range.rangeType === 'vpn',
        isProxy: range.rangeType === 'proxy',
        isDatacenter: range.rangeType === 'datacenter',
        isTor: range.rangeType === 'tor',
        blocked: true,
        riskScore: 100,
        org: range.provider || undefined,
        country: range.country || undefined,
        source: 'local_database'
      };
    }
  }
  
  return null;
}

async function checkIpApiCo(ip: string): Promise<VpnCheckResult | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,isp,org,as,proxy,hosting`);
    const data = await response.json();
    
    if (data.status !== 'success') return null;
    
    const isDatacenter = data.hosting === true || 
      KNOWN_DATACENTER_ASNS.some(asn => data.as?.includes(asn));
    
    const isVpn = KNOWN_VPN_PATTERNS.some(pattern => 
      pattern.test(data.isp || '') || pattern.test(data.org || '')
    );
    
    return {
      isVpn,
      isProxy: data.proxy === true,
      isDatacenter,
      isTor: false,
      blocked: data.proxy || isDatacenter || isVpn,
      riskScore: (data.proxy ? 50 : 0) + (isDatacenter ? 30 : 0) + (isVpn ? 20 : 0),
      isp: data.isp,
      org: data.org,
      country: data.country,
      source: 'ip-api.com'
    };
  } catch (error) {
    console.error('ip-api.com check failed:', error);
    return null;
  }
}

async function checkProxyCheck(ip: string, apiKey: string): Promise<VpnCheckResult | null> {
  try {
    const response = await fetch(`https://proxycheck.io/v2/${ip}?key=${apiKey}&vpn=1&asn=1&risk=1`);
    const data = await response.json();
    
    if (data.status !== 'ok' || !data[ip]) return null;
    
    const ipData = data[ip];
    return {
      isVpn: ipData.vpn === 'yes',
      isProxy: ipData.proxy === 'yes',
      isDatacenter: ipData.type === 'Hosting',
      isTor: false,
      blocked: ipData.vpn === 'yes' || ipData.proxy === 'yes',
      riskScore: parseInt(ipData.risk) || 0,
      isp: ipData.isp,
      org: ipData.organisation,
      country: ipData.country,
      source: 'proxycheck.io'
    };
  } catch (error) {
    console.error('proxycheck.io check failed:', error);
    return null;
  }
}

async function getCachedResult(ip: string, cacheHours: number): Promise<VpnCheckResult | null> {
  const expiryTime = new Date(Date.now() - cacheHours * 60 * 60 * 1000);
  
  const cached = await db.select().from(vpnIpCache)
    .where(and(
      eq(vpnIpCache.ipAddress, ip),
      gte(vpnIpCache.checkedAt, expiryTime)
    ))
    .limit(1);
  
  if (cached.length > 0) {
    const c = cached[0];
    return {
      isVpn: c.isVpn || false,
      isProxy: c.isProxy || false,
      isDatacenter: c.isDatacenter || false,
      isTor: c.isTor || false,
      blocked: c.isVpn || c.isProxy || c.isDatacenter || c.isTor || false,
      riskScore: c.riskScore || 0,
      isp: c.isp || undefined,
      org: c.org || undefined,
      country: c.country || undefined,
      source: c.source || 'cache'
    };
  }
  
  return null;
}

async function cacheResult(ip: string, result: VpnCheckResult, cacheHours: number): Promise<void> {
  const expiresAt = new Date(Date.now() + cacheHours * 60 * 60 * 1000);
  
  await db.insert(vpnIpCache).values({
    ipAddress: ip,
    isVpn: result.isVpn,
    isProxy: result.isProxy,
    isDatacenter: result.isDatacenter,
    isTor: result.isTor,
    isp: result.isp,
    org: result.org,
    country: result.country,
    riskScore: result.riskScore,
    source: result.source,
    expiresAt,
  }).onConflictDoUpdate({
    target: vpnIpCache.ipAddress,
    set: {
      isVpn: result.isVpn,
      isProxy: result.isProxy,
      isDatacenter: result.isDatacenter,
      isTor: result.isTor,
      isp: result.isp,
      org: result.org,
      country: result.country,
      riskScore: result.riskScore,
      source: result.source,
      checkedAt: new Date(),
      expiresAt,
    }
  });
}

export async function checkVpnProxy(ip: string, lineId?: number): Promise<{ allowed: boolean; result: VpnCheckResult | null }> {
  const settings = await getSettings();
  
  if (!settings.enabled) {
    return { allowed: true, result: null };
  }
  
  const whitelist = (settings.whitelistIps as string[]) || [];
  if (whitelist.includes(ip)) {
    return { allowed: true, result: null };
  }
  
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { allowed: true, result: null };
  }
  
  const cached = await getCachedResult(ip, settings.cacheHours || 24);
  if (cached) {
    const blocked = (settings.blockVpn && cached.isVpn) ||
                   (settings.blockProxy && cached.isProxy) ||
                   (settings.blockDatacenter && cached.isDatacenter) ||
                   (settings.blockTor && cached.isTor);
    
    if (blocked && settings.logDetections && lineId) {
      const detectionType = cached.isVpn ? 'vpn' : cached.isProxy ? 'proxy' : cached.isDatacenter ? 'datacenter' : 'tor';
      await db.insert(vpnDetectionLogs).values({
        lineId,
        ipAddress: ip,
        detectionType,
        blocked: true,
        country: cached.country,
        isp: cached.isp,
      });
    }
    
    return { allowed: !blocked, result: cached };
  }
  
  let result: VpnCheckResult | null = null;
  
  result = await checkLocalDatabase(ip);
  
  if (!result && settings.apiProvider === 'local') {
    result = await checkIpApiCo(ip);
  } else if (!result && settings.apiProvider === 'proxycheck' && settings.apiKey) {
    result = await checkProxyCheck(ip, settings.apiKey);
  } else if (!result) {
    result = await checkIpApiCo(ip);
  }
  
  if (result) {
    await cacheResult(ip, result, settings.cacheHours || 24);
    
    const blocked = (settings.blockVpn && result.isVpn) ||
                   (settings.blockProxy && result.isProxy) ||
                   (settings.blockDatacenter && result.isDatacenter) ||
                   (settings.blockTor && result.isTor);
    
    if (blocked && settings.logDetections && lineId) {
      const detectionType = result.isVpn ? 'vpn' : result.isProxy ? 'proxy' : result.isDatacenter ? 'datacenter' : 'tor';
      await db.insert(vpnDetectionLogs).values({
        lineId,
        ipAddress: ip,
        detectionType,
        blocked: true,
        userAgent: undefined,
        country: result.country,
        isp: result.isp,
      });
    }
    
    return { allowed: !blocked, result };
  }
  
  return { allowed: true, result: null };
}

export async function getVpnDetectionSettings() {
  return await getSettings();
}

export async function updateVpnDetectionSettings(updates: Partial<typeof vpnDetectionSettings.$inferInsert>) {
  const settings = await getSettings();
  const [updated] = await db.update(vpnDetectionSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(vpnDetectionSettings.id, settings.id))
    .returning();
  return updated;
}

export async function getVpnDetectionLogs(limit = 100, offset = 0) {
  return await db.select().from(vpnDetectionLogs)
    .orderBy(vpnDetectionLogs.createdAt)
    .limit(limit)
    .offset(offset);
}

export async function getVpnIpRanges() {
  return await db.select().from(vpnIpRanges).orderBy(vpnIpRanges.createdAt);
}

export async function addVpnIpRange(data: typeof vpnIpRanges.$inferInsert) {
  const [created] = await db.insert(vpnIpRanges).values(data).returning();
  return created;
}

export async function deleteVpnIpRange(id: number) {
  await db.delete(vpnIpRanges).where(eq(vpnIpRanges.id, id));
}

export async function clearVpnCache() {
  await db.delete(vpnIpCache);
}

export async function lookupIp(ip: string): Promise<VpnCheckResult | null> {
  return await checkIpApiCo(ip);
}
