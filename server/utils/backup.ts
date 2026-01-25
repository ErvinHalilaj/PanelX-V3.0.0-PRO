import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { backups } from '@shared/schema';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/panelx';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
}

export interface BackupOptions {
  type: 'full' | 'database' | 'settings';
  createdBy?: number;
  includedTables?: string[];
}

export interface BackupResult {
  id: number;
  filename: string;
  filepath: string;
  filesize: number;
  status: string;
}

/**
 * Create a database backup using pg_dump
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `panelx_${options.type}_${timestamp}`;
  const filename = `${backupName}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  // Create backup record
  const [backup] = await db.insert(backups).values({
    backupName,
    description: `${options.type} backup created at ${new Date().toISOString()}`,
    backupType: options.type,
    status: 'in_progress',
    createdBy: options.createdBy || null,
    includedTables: options.includedTables || [],
  }).returning();

  try {
    const databaseUrl = process.env.DATABASE_URL!;
    
    // Build pg_dump command
    let command = `pg_dump "${databaseUrl}"`;
    
    // Add table filters if specified
    if (options.includedTables && options.includedTables.length > 0) {
      for (const table of options.includedTables) {
        command += ` -t ${table}`;
      }
    }
    
    // Output to file
    command += ` > "${filepath}"`;

    // Execute backup
    await execAsync(command);

    // Get file size
    const stats = fs.statSync(filepath);
    const filesize = stats.size;

    // Update backup record
    await db.update(backups)
      .set({
        status: 'completed',
        filePath: filepath,
        fileSize: filesize,
        completedAt: new Date(),
      })
      .where({ id: backup.id } as any);

    return {
      id: backup.id,
      filename,
      filepath,
      filesize,
      status: 'completed',
    };

  } catch (error: any) {
    // Update backup record with error
    await db.update(backups)
      .set({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where({ id: backup.id } as any);

    throw new Error(`Backup failed: ${error.message}`);
  }
}

/**
 * Restore a database backup
 */
export async function restoreBackup(backupId: number): Promise<void> {
  // Get backup info
  const [backup] = await db.select()
    .from(backups)
    .where({ id: backupId } as any);

  if (!backup) {
    throw new Error('Backup not found');
  }

  if (!backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('Backup file not found');
  }

  try {
    const databaseUrl = process.env.DATABASE_URL!;
    
    // Restore using psql
    const command = `psql "${databaseUrl}" < "${backup.filePath}"`;
    await execAsync(command);

  } catch (error: any) {
    throw new Error(`Restore failed: ${error.message}`);
  }
}

/**
 * Delete old backups (retention policy)
 */
export async function cleanupOldBackups(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // Get old backups
  const oldBackups = await db.select()
    .from(backups)
    .where((backups as any).createdAt < cutoffDate);

  let deletedCount = 0;

  for (const backup of oldBackups) {
    try {
      // Delete file if exists
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }

      // Delete record
      await db.delete(backups).where({ id: backup.id } as any);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete backup ${backup.id}:`, error);
    }
  }

  return deletedCount;
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<any[]> {
  return db.select().from(backups).orderBy((backups as any).createdAt);
}

/**
 * Get backup by ID
 */
export async function getBackup(id: number): Promise<any> {
  const [backup] = await db.select()
    .from(backups)
    .where({ id } as any);
  return backup;
}

/**
 * Download backup file
 */
export function getBackupFile(filepath: string): Buffer {
  if (!fs.existsSync(filepath)) {
    throw new Error('Backup file not found');
  }
  return fs.readFileSync(filepath);
}
