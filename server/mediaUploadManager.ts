/**
 * Media Upload Manager
 * Handles poster, backdrop, and subtitle uploads with validation and optimization
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  url: string;
}

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

class MediaUploadManager {
  private uploadsDir: string;
  private postersDir: string;
  private backdropsDir: string;
  private subtitlesDir: string;
  private maxPosterSize = 5 * 1024 * 1024; // 5MB
  private maxBackdropSize = 10 * 1024 * 1024; // 10MB
  private maxSubtitleSize = 2 * 1024 * 1024; // 2MB
  private allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private allowedSubtitleTypes = ['text/plain', 'application/x-subrip', 'text/vtt'];
  private allowedSubtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa'];

  constructor() {
    // Use /tmp for temporary uploads in serverless environment
    this.uploadsDir = '/tmp/media-uploads';
    this.postersDir = path.join(this.uploadsDir, 'posters');
    this.backdropsDir = path.join(this.uploadsDir, 'backdrops');
    this.subtitlesDir = path.join(this.uploadsDir, 'subtitles');

    this.ensureDirectories();
  }

  /**
   * Ensure upload directories exist
   */
  private ensureDirectories(): void {
    const dirs = [this.uploadsDir, this.postersDir, this.backdropsDir, this.subtitlesDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Generate unique filename
   */
  private generateFilename(originalName: string, prefix: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}${ext}`;
  }

  /**
   * Validate file size
   */
  private validateFileSize(size: number, maxSize: number, fileType: string): void {
    if (size > maxSize) {
      throw new Error(`${fileType} size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
    }
  }

  /**
   * Validate image type
   */
  private validateImageType(mimeType: string): void {
    if (!this.allowedImageTypes.includes(mimeType)) {
      throw new Error(`Invalid image type. Allowed types: ${this.allowedImageTypes.join(', ')}`);
    }
  }

  /**
   * Validate subtitle type
   */
  private validateSubtitleType(filename: string, mimeType: string): void {
    const ext = path.extname(filename).toLowerCase();
    if (!this.allowedSubtitleExtensions.includes(ext)) {
      throw new Error(`Invalid subtitle format. Allowed formats: ${this.allowedSubtitleExtensions.join(', ')}`);
    }
  }

  /**
   * Optimize image with sharp
   */
  private async optimizeImage(
    inputPath: string,
    outputPath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<void> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'jpeg',
    } = options;

    try {
      let pipeline = sharp(inputPath);

      // Get image metadata
      const metadata = await pipeline.metadata();

      // Resize if necessary
      if (metadata.width && metadata.width > maxWidth || metadata.height && metadata.height > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert and optimize
      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      await pipeline.toFile(outputPath);
    } catch (error) {
      console.error('[MediaUploadManager] Image optimization error:', error);
      throw new Error('Failed to optimize image');
    }
  }

  /**
   * Upload poster
   */
  async uploadPoster(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    movieId: number
  ): Promise<UploadedFile> {
    try {
      // Validate
      this.validateFileSize(fileBuffer.length, this.maxPosterSize, 'Poster');
      this.validateImageType(mimeType);

      // Generate filename
      const filename = this.generateFilename(originalName, `poster_${movieId}`);
      const tempPath = path.join(this.postersDir, `temp_${filename}`);
      const finalPath = path.join(this.postersDir, filename);

      // Save temporary file
      await fs.promises.writeFile(tempPath, fileBuffer);

      // Optimize image (poster: 500x750 max, high quality)
      await this.optimizeImage(tempPath, finalPath, {
        maxWidth: 500,
        maxHeight: 750,
        quality: 90,
        format: 'jpeg',
      });

      // Delete temp file
      await fs.promises.unlink(tempPath);

      // Get final file stats
      const stats = await fs.promises.stat(finalPath);

      return {
        filename,
        originalName,
        path: finalPath,
        size: stats.size,
        mimeType: 'image/jpeg',
        url: `/api/media/posters/${filename}`,
      };
    } catch (error) {
      console.error('[MediaUploadManager] Upload poster error:', error);
      throw error;
    }
  }

  /**
   * Upload backdrop
   */
  async uploadBackdrop(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    movieId: number
  ): Promise<UploadedFile> {
    try {
      // Validate
      this.validateFileSize(fileBuffer.length, this.maxBackdropSize, 'Backdrop');
      this.validateImageType(mimeType);

      // Generate filename
      const filename = this.generateFilename(originalName, `backdrop_${movieId}`);
      const tempPath = path.join(this.backdropsDir, `temp_${filename}`);
      const finalPath = path.join(this.backdropsDir, filename);

      // Save temporary file
      await fs.promises.writeFile(tempPath, fileBuffer);

      // Optimize image (backdrop: 1920x1080 max, high quality)
      await this.optimizeImage(tempPath, finalPath, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
        format: 'jpeg',
      });

      // Delete temp file
      await fs.promises.unlink(tempPath);

      // Get final file stats
      const stats = await fs.promises.stat(finalPath);

      return {
        filename,
        originalName,
        path: finalPath,
        size: stats.size,
        mimeType: 'image/jpeg',
        url: `/api/media/backdrops/${filename}`,
      };
    } catch (error) {
      console.error('[MediaUploadManager] Upload backdrop error:', error);
      throw error;
    }
  }

  /**
   * Upload subtitle
   */
  async uploadSubtitle(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    movieId: number,
    language: string
  ): Promise<UploadedFile> {
    try {
      // Validate
      this.validateFileSize(fileBuffer.length, this.maxSubtitleSize, 'Subtitle');
      this.validateSubtitleType(originalName, mimeType);

      // Generate filename with language code
      const ext = path.extname(originalName);
      const filename = `subtitle_${movieId}_${language}_${Date.now()}${ext}`;
      const finalPath = path.join(this.subtitlesDir, filename);

      // Save file
      await fs.promises.writeFile(finalPath, fileBuffer);

      // Get file stats
      const stats = await fs.promises.stat(finalPath);

      return {
        filename,
        originalName,
        path: finalPath,
        size: stats.size,
        mimeType: mimeType || 'text/plain',
        url: `/api/media/subtitles/${filename}`,
      };
    } catch (error) {
      console.error('[MediaUploadManager] Upload subtitle error:', error);
      throw error;
    }
  }

  /**
   * Get poster file
   */
  async getPoster(filename: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.postersDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return await fs.promises.readFile(filePath);
    } catch (error) {
      console.error('[MediaUploadManager] Get poster error:', error);
      return null;
    }
  }

  /**
   * Get backdrop file
   */
  async getBackdrop(filename: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.backdropsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return await fs.promises.readFile(filePath);
    } catch (error) {
      console.error('[MediaUploadManager] Get backdrop error:', error);
      return null;
    }
  }

  /**
   * Get subtitle file
   */
  async getSubtitle(filename: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.subtitlesDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return await fs.promises.readFile(filePath);
    } catch (error) {
      console.error('[MediaUploadManager] Get subtitle error:', error);
      return null;
    }
  }

  /**
   * Delete poster
   */
  async deletePoster(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.postersDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      console.error('[MediaUploadManager] Delete poster error:', error);
      return false;
    }
  }

  /**
   * Delete backdrop
   */
  async deleteBackdrop(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.backdropsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      console.error('[MediaUploadManager] Delete backdrop error:', error);
      return false;
    }
  }

  /**
   * Delete subtitle
   */
  async deleteSubtitle(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.subtitlesDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      console.error('[MediaUploadManager] Delete subtitle error:', error);
      return false;
    }
  }

  /**
   * List posters for a movie
   */
  async listPosters(movieId: number): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.postersDir);
      return files.filter(file => file.startsWith(`poster_${movieId}_`));
    } catch (error) {
      console.error('[MediaUploadManager] List posters error:', error);
      return [];
    }
  }

  /**
   * List subtitles for a movie
   */
  async listSubtitles(movieId: number): Promise<Array<{ filename: string; language: string; size: number }>> {
    try {
      const files = await fs.promises.readdir(this.subtitlesDir);
      const subtitles = files.filter(file => file.startsWith(`subtitle_${movieId}_`));

      const result = [];
      for (const filename of subtitles) {
        const filePath = path.join(this.subtitlesDir, filename);
        const stats = await fs.promises.stat(filePath);
        
        // Extract language from filename: subtitle_123_en_1234567890.srt
        const parts = filename.split('_');
        const language = parts.length >= 3 ? parts[2] : 'unknown';

        result.push({
          filename,
          language,
          size: stats.size,
        });
      }

      return result;
    } catch (error) {
      console.error('[MediaUploadManager] List subtitles error:', error);
      return [];
    }
  }

  /**
   * Clean old files (older than 30 days)
   */
  async cleanOldFiles(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const dirs = [this.postersDir, this.backdropsDir, this.subtitlesDir];

      for (const dir of dirs) {
        const files = await fs.promises.readdir(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.promises.stat(filePath);

          if (stats.mtimeMs < thirtyDaysAgo) {
            await fs.promises.unlink(filePath);
            console.log(`[MediaUploadManager] Deleted old file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('[MediaUploadManager] Clean old files error:', error);
    }
  }
}

// Singleton instance
export const mediaUploadManager = new MediaUploadManager();
