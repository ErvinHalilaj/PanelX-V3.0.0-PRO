/**
 * Enhanced TMDB Service with Caching and Queue
 * 
 * Provides TMDB metadata lookup with database caching and batch processing.
 */

import axios from 'axios';
import { db } from "../db";
import { tmdbMetadata, tmdbSyncQueue, tmdbSyncLogs, series, vodInfo } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const TMDB_API_KEY = process.env.TMDB_API_KEY || ""; // Set in environment
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TMDBSearchResult {
  tmdbId: number;
  title: string;
  releaseDate: string;
  posterPath: string | null;
  overview: string;
  matchScore: number;
}

/**
 * Search TMDB for a movie or TV show
 */
export async function searchTMDB(
  query: string,
  mediaType: 'movie' | 'tv',
  year?: string
): Promise<TMDBSearchResult[]> {
  try {
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY not configured");
    }

    const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        query,
        year,
        language: 'en-US',
      },
    });

    return response.data.results.map((item: any) => ({
      tmdbId: item.id,
      title: mediaType === 'movie' ? item.title : item.name,
      releaseDate: mediaType === 'movie' ? item.release_date : item.first_air_date,
      posterPath: item.poster_path,
      overview: item.overview,
      matchScore: calculateMatchScore(query, mediaType === 'movie' ? item.title : item.name, year, item.release_date || item.first_air_date),
    })).sort((a: any, b: any) => b.matchScore - a.matchScore);

  } catch (error) {
    console.error("TMDB search failed:", error);
    return [];
  }
}

/**
 * Get detailed metadata from TMDB
 */
export async function getTMDBDetails(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<any> {
  try {
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY not configured");
    }

    const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        append_to_response: 'credits,videos,external_ids',
      },
    });

    return response.data;
  } catch (error) {
    console.error("TMDB details fetch failed:", error);
    return null;
  }
}

/**
 * Cache TMDB metadata in database
 */
export async function cacheTMDBMetadata(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  data: any
): Promise<void> {
  try {
    const metadata = {
      tmdbId,
      imdbId: data.external_ids?.imdb_id || data.imdb_id,
      mediaType,
      title: mediaType === 'movie' ? data.title : data.name,
      originalTitle: mediaType === 'movie' ? data.original_title : data.original_name,
      overview: data.overview,
      tagline: data.tagline,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}/w500${data.poster_path}` : null,
      backdropUrl: data.backdrop_path ? `${TMDB_IMAGE_BASE}/original${data.backdrop_path}` : null,
      releaseDate: data.release_date,
      firstAirDate: data.first_air_date,
      lastAirDate: data.last_air_date,
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      popularity: data.popularity,
      adult: data.adult,
      genres: data.genres?.map((g: any) => g.name) || [],
      productionCountries: data.production_countries?.map((c: any) => c.iso_3166_1) || [],
      spokenLanguages: data.spoken_languages?.map((l: any) => l.iso_639_1) || [],
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      episodeRunTime: data.episode_run_time || [],
      status: data.status,
      runtime: data.runtime,
      budget: data.budget,
      revenue: data.revenue,
      homepage: data.homepage,
      originalLanguage: data.original_language,
      lastSynced: new Date(),
    };

    // Check if exists
    const existing = await db
      .select()
      .from(tmdbMetadata)
      .where(eq(tmdbMetadata.tmdbId, tmdbId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(tmdbMetadata)
        .set(metadata)
        .where(eq(tmdbMetadata.id, existing[0].id));
    } else {
      await db.insert(tmdbMetadata).values(metadata);
    }
  } catch (error) {
    console.error("Failed to cache TMDB metadata:", error);
  }
}

/**
 * Get cached TMDB metadata
 */
export async function getCachedMetadata(tmdbId: number): Promise<any> {
  try {
    const cached = await db
      .select()
      .from(tmdbMetadata)
      .where(eq(tmdbMetadata.tmdbId, tmdbId))
      .limit(1);

    if (cached.length === 0) return null;

    const metadata = cached[0];
    
    // Refresh if older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (metadata.lastSynced && metadata.lastSynced < thirtyDaysAgo) {
      // Trigger async refresh
      refreshMetadata(tmdbId, metadata.mediaType as 'movie' | 'tv').catch(console.error);
    }

    return metadata;
  } catch (error) {
    console.error("Failed to get cached metadata:", error);
    return null;
  }
}

/**
 * Refresh cached metadata
 */
async function refreshMetadata(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
  const details = await getTMDBDetails(tmdbId, mediaType);
  if (details) {
    await cacheTMDBMetadata(tmdbId, mediaType, details);
  }
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  mediaType: 'movie' | 'tv',
  referenceId: number,
  referenceType: 'series' | 'vod',
  searchTitle: string,
  searchYear?: string,
  priority: number = 0
): Promise<number> {
  try {
    const inserted = await db
      .insert(tmdbSyncQueue)
      .values({
        mediaType,
        referenceId,
        referenceType,
        searchTitle,
        searchYear,
        priority,
        status: 'pending',
      })
      .returning();

    return inserted[0].id;
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
    throw error;
  }
}

/**
 * Process sync queue (batch processing)
 */
export async function processSyncQueue(batchSize: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const batchId = `batch_${Date.now()}`;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Get pending items
    const pendingItems = await db
      .select()
      .from(tmdbSyncQueue)
      .where(eq(tmdbSyncQueue.status, 'pending'))
      .orderBy(desc(tmdbSyncQueue.priority), tmdbSyncQueue.createdAt)
      .limit(batchSize);

    for (const item of pendingItems) {
      processed++;
      const startTime = Date.now();

      try {
        // Update status to processing
        await db
          .update(tmdbSyncQueue)
          .set({ 
            status: 'processing',
            lastAttempt: new Date(),
            attempts: sql`${tmdbSyncQueue.attempts} + 1`
          })
          .where(eq(tmdbSyncQueue.id, item.id));

        // Search TMDB
        const results = await searchTMDB(item.searchTitle, item.mediaType as 'movie' | 'tv', item.searchYear || undefined);

        if (results.length === 0) {
          throw new Error("No TMDB results found");
        }

        const bestMatch = results[0];

        // Get detailed metadata
        const details = await getTMDBDetails(bestMatch.tmdbId, item.mediaType as 'movie' | 'tv');
        
        if (details) {
          // Cache metadata
          await cacheTMDBMetadata(bestMatch.tmdbId, item.mediaType as 'movie' | 'tv', details);

          // Update reference (series or vodInfo)
          if (item.referenceType === 'series') {
            await db
              .update(series)
              .set({
                tmdbId: bestMatch.tmdbId.toString(),
                cover: bestMatch.posterPath ? `${TMDB_IMAGE_BASE}/w500${bestMatch.posterPath}` : undefined,
                backdrop: details.backdrop_path ? `${TMDB_IMAGE_BASE}/original${details.backdrop_path}` : undefined,
                plot: details.overview,
                genre: details.genres?.map((g: any) => g.name).join(', '),
                releaseDate: details.first_air_date,
                rating: details.vote_average?.toString(),
              })
              .where(eq(series.id, item.referenceId));
          } else if (item.referenceType === 'vod') {
            await db
              .update(vodInfo)
              .set({
                tmdbId: bestMatch.tmdbId,
                plot: details.overview,
                cast: details.credits?.cast?.slice(0, 5).map((c: any) => c.name).join(', '),
                director: details.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
                genre: details.genres?.map((g: any) => g.name).join(', '),
                releaseDate: details.release_date,
                rating: details.vote_average?.toFixed(1),
              })
              .where(eq(vodInfo.id, item.referenceId));
          }

          // Mark as completed
          await db
            .update(tmdbSyncQueue)
            .set({
              status: 'completed',
              tmdbId: bestMatch.tmdbId,
              matchScore: bestMatch.matchScore,
              completedAt: new Date(),
            })
            .where(eq(tmdbSyncQueue.id, item.id));

          // Log success
          await db.insert(tmdbSyncLogs).values({
            batchId,
            mediaType: item.mediaType,
            referenceId: item.referenceId,
            searchTitle: item.searchTitle,
            status: 'success',
            tmdbId: bestMatch.tmdbId,
            matchScore: bestMatch.matchScore,
            action: 'updated',
            message: `Successfully synced: ${bestMatch.title}`,
            processingTime: Date.now() - startTime,
          });

          succeeded++;
        } else {
          throw new Error("Failed to fetch TMDB details");
        }

      } catch (error: any) {
        failed++;

        // Mark as failed
        await db
          .update(tmdbSyncQueue)
          .set({
            status: item.attempts >= 2 ? 'failed' : 'pending', // Retry up to 3 times
            errorMessage: error.message,
          })
          .where(eq(tmdbSyncQueue.id, item.id));

        // Log failure
        await db.insert(tmdbSyncLogs).values({
          batchId,
          mediaType: item.mediaType,
          referenceId: item.referenceId,
          searchTitle: item.searchTitle,
          status: 'failed',
          message: `Sync failed: ${error.message}`,
          errorDetails: error.stack,
          processingTime: Date.now() - startTime,
        });
      }

      // Rate limiting: wait 250ms between requests
      await new Promise(resolve => setTimeout(resolve, 250));
    }

  } catch (error) {
    console.error("Failed to process sync queue:", error);
  }

  return { processed, succeeded, failed };
}

/**
 * Calculate match score between search query and result
 */
function calculateMatchScore(query: string, title: string, queryYear?: string, resultDate?: string): number {
  let score = 0;

  // Normalize strings
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTitle = title.toLowerCase().trim();

  // Exact match
  if (normalizedQuery === normalizedTitle) {
    score += 100;
  }
  // Contains match
  else if (normalizedTitle.includes(normalizedQuery)) {
    score += 80;
  }
  // Partial match
  else {
    const queryWords = normalizedQuery.split(/\s+/);
    const titleWords = normalizedTitle.split(/\s+/);
    const matchedWords = queryWords.filter(qw => titleWords.some(tw => tw.includes(qw)));
    score += (matchedWords.length / queryWords.length) * 60;
  }

  // Year match
  if (queryYear && resultDate) {
    const resultYear = resultDate.split('-')[0];
    if (queryYear === resultYear) {
      score += 20;
    } else if (Math.abs(parseInt(queryYear) - parseInt(resultYear)) <= 1) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<any> {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM tmdb_sync_queue
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get sync queue stats:", error);
    return {};
  }
}
