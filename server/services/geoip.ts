/**
 * GeoIP Service
 * 
 * Provides IP geolocation lookup and caching.
 * Uses geoip-lite for fast local lookups.
 */

import geoip from 'geoip-lite';
import { db } from "../db";
import { geoLocations, connectionGeoStats } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface GeoData {
  ipAddress: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  organization: string | null;
  asn: string | null;
}

/**
 * Lookup geographic information for an IP address
 * Uses cache-first strategy for performance
 */
export async function lookupIP(ipAddress: string): Promise<GeoData | null> {
  try {
    // Clean IP address (remove IPv6 prefix if present)
    const cleanIP = ipAddress.replace(/^::ffff:/, '');
    
    // Check cache first
    const cached = await db
      .select()
      .from(geoLocations)
      .where(eq(geoLocations.ipAddress, cleanIP))
      .limit(1);

    if (cached.length > 0) {
      const cache = cached[0];
      // Refresh cache if older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (cache.lastUpdated && cache.lastUpdated > thirtyDaysAgo) {
        return {
          ipAddress: cache.ipAddress,
          country: cache.country,
          countryCode: cache.countryCode,
          region: cache.region,
          regionCode: cache.regionCode,
          city: cache.city,
          postalCode: cache.postalCode,
          latitude: cache.latitude,
          longitude: cache.longitude,
          timezone: cache.timezone,
          isp: cache.isp,
          organization: cache.organization,
          asn: cache.asn,
        };
      }
    }

    // Perform fresh lookup
    const geo = geoip.lookup(cleanIP);
    
    if (!geo) {
      return null;
    }

    const geoData: GeoData = {
      ipAddress: cleanIP,
      country: geo.country || null,
      countryCode: geo.country || null,
      region: geo.region || null,
      regionCode: geo.region || null,
      city: geo.city || null,
      postalCode: null,
      latitude: geo.ll?.[0] || null,
      longitude: geo.ll?.[1] || null,
      timezone: geo.timezone || null,
      isp: null,
      organization: null,
      asn: null,
    };

    // Cache the result
    await cacheGeoData(geoData);

    return geoData;
  } catch (error) {
    console.error("Failed to lookup IP:", ipAddress, error);
    return null;
  }
}

/**
 * Cache geographic data in database
 */
async function cacheGeoData(geoData: GeoData): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(geoLocations)
      .where(eq(geoLocations.ipAddress, geoData.ipAddress))
      .limit(1);

    if (existing.length > 0) {
      // Update existing cache
      await db
        .update(geoLocations)
        .set({
          country: geoData.country,
          countryCode: geoData.countryCode,
          region: geoData.region,
          regionCode: geoData.regionCode,
          city: geoData.city,
          postalCode: geoData.postalCode,
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          timezone: geoData.timezone,
          isp: geoData.isp,
          organization: geoData.organization,
          asn: geoData.asn,
          lastUpdated: new Date(),
        })
        .where(eq(geoLocations.id, existing[0].id));
    } else {
      // Insert new cache entry
      await db.insert(geoLocations).values({
        ipAddress: geoData.ipAddress,
        country: geoData.country,
        countryCode: geoData.countryCode,
        region: geoData.region,
        regionCode: geoData.regionCode,
        city: geoData.city,
        postalCode: geoData.postalCode,
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        timezone: geoData.timezone,
        isp: geoData.isp,
        organization: geoData.organization,
        asn: geoData.asn,
        lookupProvider: "geoip-lite",
      });
    }
  } catch (error) {
    console.error("Failed to cache geo data:", error);
  }
}

/**
 * Get active connections with geographic data
 */
export async function getActiveConnectionsMap(): Promise<any[]> {
  try {
    const query = `
      SELECT 
        ac.id,
        ac.line_id as "lineId",
        ac.stream_id as "streamId",
        ac.ip_address as "ipAddress",
        ac.user_agent as "userAgent",
        ac.started_at as "startedAt",
        ac.last_ping as "lastPing",
        gl.country,
        gl.country_code as "countryCode",
        gl.city,
        gl.latitude,
        gl.longitude,
        l.username as "lineUsername",
        s.stream_display_name as "streamName"
      FROM active_connections ac
      LEFT JOIN geo_locations gl ON ac.ip_address = gl.ip_address
      LEFT JOIN lines l ON ac.line_id = l.id
      LEFT JOIN streams s ON ac.stream_id = s.id
      WHERE ac.last_ping > NOW() - INTERVAL '10 minutes'
      ORDER BY ac.started_at DESC
      LIMIT 1000
    `;

    const result = await db.execute(sql.raw(query));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get active connections map:", error);
    return [];
  }
}

/**
 * Get connection statistics by country
 */
export async function getConnectionStatsByCountry(
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  try {
    const query = `
      SELECT 
        country,
        country_code as "countryCode",
        SUM(total_connections) as "totalConnections",
        AVG(active_connections) as "avgActiveConnections",
        SUM(total_bandwidth) as "totalBandwidth"
      FROM connection_geo_stats
      WHERE period_start >= $1 AND period_end <= $2
      GROUP BY country, country_code
      ORDER BY SUM(total_connections) DESC
      LIMIT 50
    `;

    const result = await db.execute(sql.raw(query, [startTime, endTime]));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get connection stats by country:", error);
    return [];
  }
}

/**
 * Aggregate geographic statistics for a time period
 */
export async function aggregateGeoStats(
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  try {
    const query = `
      INSERT INTO connection_geo_stats (country, country_code, city, total_connections, active_connections, period_start, period_end)
      SELECT 
        gl.country,
        gl.country_code,
        gl.city,
        COUNT(*) as total_connections,
        COUNT(CASE WHEN ac.last_ping > NOW() - INTERVAL '10 minutes' THEN 1 END) as active_connections,
        $1 as period_start,
        $2 as period_end
      FROM active_connections ac
      LEFT JOIN geo_locations gl ON ac.ip_address = gl.ip_address
      WHERE ac.started_at >= $1 AND ac.started_at < $2
      GROUP BY gl.country, gl.country_code, gl.city
      ON CONFLICT DO NOTHING
    `;

    await db.execute(sql.raw(query, [periodStart, periodEnd]));
  } catch (error) {
    console.error("Failed to aggregate geo stats:", error);
  }
}

/**
 * Get top countries by connection count
 */
export async function getTopCountries(limit: number = 10): Promise<any[]> {
  try {
    const query = `
      SELECT 
        gl.country,
        gl.country_code as "countryCode",
        COUNT(DISTINCT ac.id) as "connectionCount",
        COUNT(DISTINCT ac.line_id) as "uniqueLines",
        AVG(gl.latitude) as "avgLatitude",
        AVG(gl.longitude) as "avgLongitude"
      FROM active_connections ac
      LEFT JOIN geo_locations gl ON ac.ip_address = gl.ip_address
      WHERE ac.last_ping > NOW() - INTERVAL '10 minutes'
        AND gl.country IS NOT NULL
      GROUP BY gl.country, gl.country_code
      ORDER BY COUNT(DISTINCT ac.id) DESC
      LIMIT $1
    `;

    const result = await db.execute(sql.raw(query, [limit]));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get top countries:", error);
    return [];
  }
}

/**
 * Get connection heatmap data (lat/lng clusters)
 */
export async function getConnectionHeatmap(): Promise<any[]> {
  try {
    const query = `
      SELECT 
        gl.latitude,
        gl.longitude,
        gl.city,
        gl.country,
        COUNT(*) as "connectionCount"
      FROM active_connections ac
      LEFT JOIN geo_locations gl ON ac.ip_address = gl.ip_address
      WHERE ac.last_ping > NOW() - INTERVAL '10 minutes'
        AND gl.latitude IS NOT NULL
        AND gl.longitude IS NOT NULL
      GROUP BY gl.latitude, gl.longitude, gl.city, gl.country
      ORDER BY COUNT(*) DESC
      LIMIT 500
    `;

    const result = await db.execute(sql.raw(query));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get connection heatmap:", error);
    return [];
  }
}

/**
 * Enrich active connection with geographic data
 */
export async function enrichConnectionWithGeo(
  ipAddress: string
): Promise<GeoData | null> {
  return await lookupIP(ipAddress);
}

/**
 * Clean up old geo cache entries
 */
export async function cleanupGeoCache(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(geoLocations)
      .where(lte(geoLocations.lastUpdated, cutoffDate));

    return result.rowCount || 0;
  } catch (error) {
    console.error("Failed to cleanup geo cache:", error);
    return 0;
  }
}
