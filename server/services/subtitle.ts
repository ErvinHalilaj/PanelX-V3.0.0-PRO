/**
 * Subtitle Management Service
 * 
 * Handles subtitle upload, download, format conversion, and management.
 */

import { db } from "../db";
import { 
  subtitles,
  subtitleSearchCache,
  subtitleUploadQueue,
  subtitleDownloadLogs
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';

const SUBTITLE_STORAGE_PATH = process.env.SUBTITLE_STORAGE_PATH || '/tmp/subtitles';

// Ensure subtitle directory exists
if (!fs.existsSync(SUBTITLE_STORAGE_PATH)) {
  fs.mkdirSync(SUBTITLE_STORAGE_PATH, { recursive: true });
}

export interface SubtitleUpload {
  referenceType: 'stream' | 'vod' | 'series_episode';
  referenceId: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  language: string;
  languageName: string;
  fileName: string;
  fileContent: string | Buffer;
  format?: string;
  userId?: number;
}

/**
 * Upload and save subtitle
 */
export async function uploadSubtitle(upload: SubtitleUpload): Promise<number> {
  try {
    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = upload.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(
      SUBTITLE_STORAGE_PATH,
      upload.referenceType,
      upload.referenceId.toString(),
      `${timestamp}_${upload.language}_${sanitizedFileName}`
    );

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, upload.fileContent);

    // Detect format from extension or content
    const format = detectSubtitleFormat(upload.fileName, upload.fileContent.toString());

    // Get file size
    const fileSize = fs.statSync(filePath).size;

    // Insert subtitle record
    const inserted = await db
      .insert(subtitles)
      .values({
        referenceType: upload.referenceType,
        referenceId: upload.referenceId,
        seriesId: upload.seriesId,
        seasonNumber: upload.seasonNumber,
        episodeNumber: upload.episodeNumber,
        language: upload.language,
        languageName: upload.languageName,
        fileName: upload.fileName,
        filePath,
        fileSize,
        format,
        encoding: 'utf-8',
        uploadedBy: upload.userId,
        enabled: true,
        verified: false,
      })
      .returning();

    return inserted[0].id;
  } catch (error) {
    console.error("Failed to upload subtitle:", error);
    throw error;
  }
}

/**
 * Get subtitles for content
 */
export async function getSubtitles(
  referenceType: string,
  referenceId: number,
  language?: string
): Promise<any[]> {
  try {
    const conditions: any[] = [
      eq(subtitles.referenceType, referenceType),
      eq(subtitles.referenceId, referenceId),
      eq(subtitles.enabled, true),
    ];

    if (language) {
      conditions.push(eq(subtitles.language, language));
    }

    return await db
      .select()
      .from(subtitles)
      .where(and(...conditions))
      .orderBy(desc(subtitles.createdAt));
  } catch (error) {
    console.error("Failed to get subtitles:", error);
    return [];
  }
}

/**
 * Download subtitle content
 */
export async function downloadSubtitle(
  subtitleId: number,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<{ content: string; fileName: string; format: string } | null> {
  try {
    const subtitle = await db
      .select()
      .from(subtitles)
      .where(eq(subtitles.id, subtitleId))
      .limit(1);

    if (subtitle.length === 0) {
      return null;
    }

    const sub = subtitle[0];

    // Read file content
    const content = fs.readFileSync(sub.filePath, 'utf-8');

    // Log download
    await db.insert(subtitleDownloadLogs).values({
      subtitleId,
      userId,
      ipAddress,
      userAgent,
    });

    // Increment download count
    await db
      .update(subtitles)
      .set({ downloads: sql`${subtitles.downloads} + 1` })
      .where(eq(subtitles.id, subtitleId));

    return {
      content,
      fileName: sub.fileName,
      format: sub.format || 'srt',
    };
  } catch (error) {
    console.error("Failed to download subtitle:", error);
    return null;
  }
}

/**
 * Convert subtitle format
 */
export function convertSubtitleFormat(
  content: string,
  fromFormat: string,
  toFormat: string
): string {
  // Basic SRT to VTT conversion
  if (fromFormat === 'srt' && toFormat === 'vtt') {
    return convertSrtToVtt(content);
  }

  // Add more conversions as needed
  return content;
}

/**
 * Convert SRT to WebVTT format
 */
function convertSrtToVtt(srtContent: string): string {
  let vttContent = 'WEBVTT\n\n';
  
  // Replace comma with dot in timestamps
  vttContent += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  return vttContent;
}

/**
 * Detect subtitle format from filename or content
 */
function detectSubtitleFormat(fileName: string, content: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.srt') return 'srt';
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass') return 'ass';
  if (ext === '.ssa') return 'ssa';

  // Detect from content
  if (content.startsWith('WEBVTT')) return 'vtt';
  if (content.includes('[Script Info]')) return 'ass';
  if (content.match(/^\d+\s*$/m)) return 'srt';

  return 'srt'; // default
}

/**
 * Delete subtitle
 */
export async function deleteSubtitle(subtitleId: number): Promise<void> {
  try {
    const subtitle = await db
      .select()
      .from(subtitles)
      .where(eq(subtitles.id, subtitleId))
      .limit(1);

    if (subtitle.length === 0) {
      throw new Error("Subtitle not found");
    }

    const sub = subtitle[0];

    // Delete file
    if (fs.existsSync(sub.filePath)) {
      fs.unlinkSync(sub.filePath);
    }

    // Delete database record
    await db.delete(subtitles).where(eq(subtitles.id, subtitleId));
  } catch (error) {
    console.error("Failed to delete subtitle:", error);
    throw error;
  }
}

/**
 * Update subtitle metadata
 */
export async function updateSubtitle(
  subtitleId: number,
  updates: {
    language?: string;
    languageName?: string;
    title?: string;
    hearingImpaired?: boolean;
    forced?: boolean;
    enabled?: boolean;
    verified?: boolean;
  }
): Promise<void> {
  try {
    await db
      .update(subtitles)
      .set(updates)
      .where(eq(subtitles.id, subtitleId));
  } catch (error) {
    console.error("Failed to update subtitle:", error);
    throw error;
  }
}

/**
 * Get subtitle statistics
 */
export async function getSubtitleStats(): Promise<any> {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_subtitles,
        COUNT(DISTINCT language) as total_languages,
        COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_subtitles,
        COUNT(CASE WHEN verified = true THEN 1 END) as verified_subtitles,
        SUM(downloads) as total_downloads,
        AVG(rating) as average_rating
      FROM subtitles
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get subtitle stats:", error);
    return {};
  }
}

/**
 * Get popular languages
 */
export async function getPopularLanguages(limit: number = 10): Promise<any[]> {
  try {
    const query = `
      SELECT 
        language,
        language_name as "languageName",
        COUNT(*) as "subtitleCount",
        SUM(downloads) as "totalDownloads"
      FROM subtitles
      WHERE enabled = true
      GROUP BY language, language_name
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `;

    const result = await db.execute(sql.raw(query, [limit]));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get popular languages:", error);
    return [];
  }
}

/**
 * Search subtitles across all content
 */
export async function searchSubtitles(query: {
  language?: string;
  referenceType?: string;
  verified?: boolean;
  limit?: number;
}): Promise<any[]> {
  try {
    const conditions: any[] = [eq(subtitles.enabled, true)];

    if (query.language) {
      conditions.push(eq(subtitles.language, query.language));
    }
    if (query.referenceType) {
      conditions.push(eq(subtitles.referenceType, query.referenceType));
    }
    if (query.verified !== undefined) {
      conditions.push(eq(subtitles.verified, query.verified));
    }

    return await db
      .select()
      .from(subtitles)
      .where(and(...conditions))
      .orderBy(desc(subtitles.downloads))
      .limit(query.limit || 50);
  } catch (error) {
    console.error("Failed to search subtitles:", error);
    return [];
  }
}

/**
 * Batch import subtitles from directory
 */
export async function batchImportSubtitles(
  directoryPath: string,
  referenceType: string,
  referenceId: number,
  userId?: number
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;

  try {
    if (!fs.existsSync(directoryPath)) {
      throw new Error("Directory not found");
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      if (!file.match(/\.(srt|vtt|ass|ssa)$/i)) {
        continue;
      }

      try {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath);

        // Extract language from filename (e.g., "movie.en.srt" -> "en")
        const langMatch = file.match(/\.([a-z]{2})\.(?:srt|vtt|ass|ssa)$/i);
        const language = langMatch ? langMatch[1].toLowerCase() : 'en';
        const languageName = getLanguageName(language);

        await uploadSubtitle({
          referenceType: referenceType as any,
          referenceId,
          language,
          languageName,
          fileName: file,
          fileContent: content,
          userId,
        });

        imported++;
      } catch (error) {
        console.error(`Failed to import ${file}:`, error);
        failed++;
      }
    }
  } catch (error) {
    console.error("Failed to batch import subtitles:", error);
  }

  return { imported, failed };
}

/**
 * Get language name from ISO 639-1 code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    tr: 'Turkish',
    pl: 'Polish',
    nl: 'Dutch',
    sv: 'Swedish',
    da: 'Danish',
    fi: 'Finnish',
    no: 'Norwegian',
  };

  return languages[code] || code.toUpperCase();
}
