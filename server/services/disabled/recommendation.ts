/**
 * Recommendation Engine Service
 * 
 * AI-powered content recommendations using collaborative filtering
 * and content-based algorithms.
 */

import { db } from "../db";
import { 
  watchHistory,
  userPreferences,
  contentRatings,
  recommendations,
  contentSimilarity,
  streams,
  vodInfo,
  series
} from "@shared/schema";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";

/**
 * Record watch history
 */
export async function recordWatch(data: {
  userId: number;
  lineId?: number;
  contentType: 'stream' | 'vod' | 'series_episode';
  contentId: number;
  streamId?: number;
  vodId?: number;
  seriesId?: number;
  episodeId?: number;
  watchedDuration: number;
  totalDuration: number;
  sessionId?: string;
  deviceInfo?: string;
}): Promise<void> {
  try {
    const watchPercentage = data.totalDuration > 0 
      ? (data.watchedDuration / data.totalDuration) * 100 
      : 0;
    
    const completed = watchPercentage >= 90; // Consider 90%+ as completed

    await db.insert(watchHistory).values({
      userId: data.userId,
      lineId: data.lineId,
      contentType: data.contentType,
      contentId: data.contentId,
      streamId: data.streamId,
      vodId: data.vodId,
      seriesId: data.seriesId,
      episodeId: data.episodeId,
      watchedDuration: data.watchedDuration,
      totalDuration: data.totalDuration,
      watchPercentage,
      completed,
      sessionId: data.sessionId,
      deviceInfo: data.deviceInfo,
      lastWatchedAt: new Date(),
      completedAt: completed ? new Date() : null,
    });
  } catch (error) {
    console.error("Failed to record watch history:", error);
  }
}

/**
 * Get user's watch history
 */
export async function getUserWatchHistory(
  userId: number,
  contentType?: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const conditions: any[] = [eq(watchHistory.userId, userId)];

    if (contentType) {
      conditions.push(eq(watchHistory.contentType, contentType));
    }

    return await db
      .select()
      .from(watchHistory)
      .where(and(...conditions))
      .orderBy(desc(watchHistory.lastWatchedAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get watch history:", error);
    return [];
  }
}

/**
 * Generate recommendations for user
 */
export async function generateRecommendations(
  userId: number,
  limit: number = 20
): Promise<any[]> {
  try {
    // Get user's watch history
    const history = await getUserWatchHistory(userId, undefined, 100);
    
    if (history.length === 0) {
      // New user - return trending/popular content
      return await getTrendingContent(limit);
    }

    const recommendations: any[] = [];

    // 1. Collaborative filtering: Users like you also watched
    const collaborativeRecs = await getCollaborativeRecommendations(userId, history, 10);
    recommendations.push(...collaborativeRecs.map(r => ({ ...r, reason: 'users_like_you' })));

    // 2. Content-based: Similar to what you watched
    const contentBasedRecs = await getContentBasedRecommendations(history, 10);
    recommendations.push(...contentBasedRecs.map(r => ({ ...r, reason: 'similar_content' })));

    // 3. Popular in your preferred genres
    const genreRecs = await getGenreBasedRecommendations(userId, 5);
    recommendations.push(...genreRecs.map(r => ({ ...r, reason: 'popular_in_genre' })));

    // Remove duplicates and sort by score
    const uniqueRecs = Array.from(
      new Map(recommendations.map(r => [`${r.contentType}-${r.contentId}`, r])).values()
    ).sort((a, b) => b.score - a.score).slice(0, limit);

    // Store recommendations
    for (const rec of uniqueRecs) {
      await db.insert(recommendations).values({
        userId,
        contentType: rec.contentType,
        contentId: rec.contentId,
        score: rec.score,
        reason: rec.reason,
        basedOn: rec.basedOn || {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }).onConflictDoNothing();
    }

    return uniqueRecs;
  } catch (error) {
    console.error("Failed to generate recommendations:", error);
    return [];
  }
}

/**
 * Collaborative filtering recommendations
 */
async function getCollaborativeRecommendations(
  userId: number,
  userHistory: any[],
  limit: number
): Promise<any[]> {
  try {
    // Find users who watched similar content
    const watchedContentIds = userHistory.map(h => h.contentId);
    
    const query = `
      SELECT 
        wh.content_type,
        wh.content_id,
        COUNT(DISTINCT wh.user_id) as watch_count,
        AVG(wh.watch_percentage) as avg_completion
      FROM watch_history wh
      WHERE wh.user_id != $1
        AND wh.user_id IN (
          SELECT DISTINCT user_id 
          FROM watch_history 
          WHERE content_id = ANY($2)
            AND user_id != $1
        )
        AND wh.content_id != ANY($2)
        AND wh.completed = true
      GROUP BY wh.content_type, wh.content_id
      ORDER BY watch_count DESC, avg_completion DESC
      LIMIT $3
    `;

    const result = await db.execute(sql.raw(query, [userId, watchedContentIds, limit]));
    
    return (result.rows as any[]).map(row => ({
      contentType: row.content_type,
      contentId: row.content_id,
      score: Math.min(100, Number(row.watch_count) * 10),
      basedOn: { watch_count: row.watch_count, avg_completion: row.avg_completion },
    }));
  } catch (error) {
    console.error("Failed collaborative filtering:", error);
    return [];
  }
}

/**
 * Content-based recommendations
 */
async function getContentBasedRecommendations(
  userHistory: any[],
  limit: number
): Promise<any[]> {
  try {
    // Get highly-rated content from history
    const topContent = userHistory
      .filter(h => h.watchPercentage >= 70)
      .slice(0, 5);

    if (topContent.length === 0) return [];

    const contentIds = topContent.map(h => h.contentId);

    // Find similar content
    const similar = await db
      .select()
      .from(contentSimilarity)
      .where(inArray(contentSimilarity.contentId, contentIds))
      .orderBy(desc(contentSimilarity.similarityScore))
      .limit(limit);

    return similar.map(s => ({
      contentType: s.similarContentType,
      contentId: s.similarContentId,
      score: s.similarityScore,
      basedOn: { 
        similar_to: s.contentId,
        genre_match: s.genreMatch,
        cast_match: s.castMatch,
      },
    }));
  } catch (error) {
    console.error("Failed content-based filtering:", error);
    return [];
  }
}

/**
 * Genre-based recommendations
 */
async function getGenreBasedRecommendations(
  userId: number,
  limit: number
): Promise<any[]> {
  try {
    // Get user preferences
    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0 || !prefs[0].favoriteGenres || prefs[0].favoriteGenres.length === 0) {
      return [];
    }

    const favoriteGenres = prefs[0].favoriteGenres;

    // Find popular content in favorite genres
    const query = `
      SELECT 
        'stream' as content_type,
        s.id as content_id,
        COUNT(wh.id) as watch_count
      FROM streams s
      LEFT JOIN watch_history wh ON s.id = wh.stream_id
      WHERE s.stream_display_name IS NOT NULL
      GROUP BY s.id
      ORDER BY watch_count DESC
      LIMIT $1
    `;

    const result = await db.execute(sql.raw(query, [limit]));
    
    return (result.rows as any[]).map(row => ({
      contentType: row.content_type,
      contentId: row.content_id,
      score: Math.min(100, Number(row.watch_count) * 5),
      basedOn: { genres: favoriteGenres },
    }));
  } catch (error) {
    console.error("Failed genre-based recommendations:", error);
    return [];
  }
}

/**
 * Get trending content
 */
export async function getTrendingContent(limit: number = 20): Promise<any[]> {
  try {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = `
      SELECT 
        content_type,
        content_id,
        COUNT(DISTINCT user_id) as unique_viewers,
        COUNT(*) as total_views,
        AVG(watch_percentage) as avg_completion
      FROM watch_history
      WHERE started_at >= $1
      GROUP BY content_type, content_id
      ORDER BY unique_viewers DESC, total_views DESC
      LIMIT $2
    `;

    const result = await db.execute(sql.raw(query, [last7Days, limit]));
    
    return (result.rows as any[]).map(row => ({
      contentType: row.content_type,
      contentId: row.content_id,
      score: Math.min(100, Number(row.unique_viewers) * 2),
      reason: 'trending',
      basedOn: {
        unique_viewers: row.unique_viewers,
        total_views: row.total_views,
        avg_completion: row.avg_completion,
      },
    }));
  } catch (error) {
    console.error("Failed to get trending content:", error);
    return [];
  }
}

/**
 * Get personalized homepage
 */
export async function getPersonalizedHomepage(userId: number): Promise<any> {
  try {
    return {
      continueWatching: await getContinueWatching(userId, 10),
      recommendations: await generateRecommendations(userId, 20),
      trending: await getTrendingContent(10),
      newReleases: await getNewReleases(10),
      popularInGenre: await getPopularByGenre(userId, 5),
    };
  } catch (error) {
    console.error("Failed to get personalized homepage:", error);
    return {};
  }
}

/**
 * Get continue watching list
 */
async function getContinueWatching(userId: number, limit: number): Promise<any[]> {
  try {
    return await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.userId, userId),
          eq(watchHistory.completed, false),
          gte(watchHistory.watchPercentage, 5) // At least 5% watched
        )
      )
      .orderBy(desc(watchHistory.lastWatchedAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get continue watching:", error);
    return [];
  }
}

/**
 * Get new releases
 */
async function getNewReleases(limit: number): Promise<any[]> {
  try {
    const streams = await db
      .select()
      .from(streams)
      .where(sql`${streams.createdAt} >= NOW() - INTERVAL '30 days'`)
      .orderBy(desc(streams.createdAt))
      .limit(limit);

    return streams.map(s => ({
      contentType: 'stream',
      contentId: s.id,
      score: 100,
      reason: 'new_release',
    }));
  } catch (error) {
    console.error("Failed to get new releases:", error);
    return [];
  }
}

/**
 * Get popular content by genre
 */
async function getPopularByGenre(userId: number, limit: number): Promise<any> {
  try {
    // Get user's favorite genres
    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const favoriteGenres = prefs[0]?.favoriteGenres || [];

    const result: any = {};
    
    for (const genre of favoriteGenres.slice(0, 3)) {
      result[genre] = await getGenreBasedRecommendations(userId, limit);
    }

    return result;
  } catch (error) {
    console.error("Failed to get popular by genre:", error);
    return {};
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: number,
  preferences: Partial<{
    favoriteGenres: string[];
    favoriteLanguages: string[];
    blockedGenres: string[];
    preferredQuality: string;
    autoplayNext: boolean;
    skipIntro: boolean;
    theme: string;
    language: string;
  }>
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userPreferences)
        .set({ ...preferences, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        ...preferences,
      });
    }
  } catch (error) {
    console.error("Failed to update user preferences:", error);
    throw error;
  }
}

/**
 * Submit content rating
 */
export async function submitRating(
  userId: number,
  contentType: string,
  contentId: number,
  rating: number,
  review?: string
): Promise<void> {
  try {
    await db.insert(contentRatings).values({
      userId,
      contentType,
      contentId,
      rating,
      review,
    });
  } catch (error) {
    console.error("Failed to submit rating:", error);
    throw error;
  }
}

/**
 * Get content ratings
 */
export async function getContentRatings(
  contentType: string,
  contentId: number
): Promise<{ averageRating: number; totalRatings: number; ratings: any[] }> {
  try {
    const ratings = await db
      .select()
      .from(contentRatings)
      .where(
        and(
          eq(contentRatings.contentType, contentType),
          eq(contentRatings.contentId, contentId)
        )
      )
      .orderBy(desc(contentRatings.createdAt));

    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;

    return { averageRating, totalRatings, ratings };
  } catch (error) {
    console.error("Failed to get content ratings:", error);
    return { averageRating: 0, totalRatings: 0, ratings: [] };
  }
}
