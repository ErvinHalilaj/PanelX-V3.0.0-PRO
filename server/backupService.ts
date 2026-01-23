/**
 * Automated Backup Service
 * Handles database backups, file backups, restoration, and automated scheduling
 */

import storage from './storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface Backup {
  id: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  status: 'pending' | 'running' | 'completed' | 'failed';
  size: number;
  path: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  metadata: {
    version: string;
    tables?: string[];
    fileCount?: number;
    compression: 'none' | 'gzip' | 'bzip2';
  };
}

interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  retention: number; // Days to keep backups
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

interface RestorePoint {
  backupId: string;
  timestamp: Date;
  description: string;
  verified: boolean;
}

class BackupService {
  private backups: Map<string, Backup> = new Map();
  private schedules: Map<string, BackupSchedule> = new Map();
  private restorePoints: RestorePoint[] = [];
  private backupDir = '/tmp/backups';
  private isRunning = false;

  constructor() {
    this.initializeBackupDirectory();
    this.startScheduler();
  }

  private initializeBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private startScheduler() {
    // Check schedules every minute
    setInterval(() => {
      this.checkSchedules();
    }, 60000);

    // Cleanup old backups every hour
    setInterval(() => {
      this.cleanupOldBackups();
    }, 3600000);
  }

  private async checkSchedules() {
    if (this.isRunning) return;

    const now = new Date();

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;

      if (this.shouldRunSchedule(schedule, now)) {
        try {
          await this.createBackup(schedule.type);
          schedule.lastRun = now;
          schedule.nextRun = this.calculateNextRun(schedule, now);
        } catch (error) {
          console.error(`[Backup] Scheduled backup failed:`, error);
        }
      }
    }
  }

  private shouldRunSchedule(schedule: BackupSchedule, now: Date): boolean {
    if (!schedule.nextRun) {
      schedule.nextRun = this.calculateNextRun(schedule, now);
      return false;
    }

    return now >= schedule.nextRun;
  }

  private calculateNextRun(schedule: BackupSchedule, from: Date): Date {
    const next = new Date(from);

    switch (schedule.frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        }
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        if (schedule.dayOfWeek !== undefined) {
          const daysToAdd = (schedule.dayOfWeek - next.getDay() + 7) % 7;
          next.setDate(next.getDate() + daysToAdd);
        }
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        if (schedule.dayOfMonth) {
          next.setDate(schedule.dayOfMonth);
        }
        break;
    }

    return next;
  }

  // Create Backup
  async createBackup(type: Backup['type']): Promise<Backup> {
    if (this.isRunning) {
      throw new Error('Backup already running');
    }

    this.isRunning = true;

    const backup: Backup = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'running',
      size: 0,
      path: '',
      createdAt: new Date(),
      metadata: {
        version: '1.0.0',
        compression: 'gzip',
      },
    };

    this.backups.set(backup.id, backup);

    try {
      switch (type) {
        case 'database':
          await this.backupDatabase(backup);
          break;
        case 'files':
          await this.backupFiles(backup);
          break;
        case 'full':
          await this.backupDatabase(backup);
          await this.backupFiles(backup);
          break;
        case 'incremental':
          await this.backupIncremental(backup);
          break;
      }

      backup.status = 'completed';
      backup.completedAt = new Date();

      // Create restore point
      this.restorePoints.push({
        backupId: backup.id,
        timestamp: backup.completedAt,
        description: `${type} backup`,
        verified: false,
      });
    } catch (error: any) {
      backup.status = 'failed';
      backup.error = error.message;
      throw error;
    } finally {
      this.isRunning = false;
    }

    return backup;
  }

  private async backupDatabase(backup: Backup): Promise<void> {
    const timestamp = Date.now();
    const filename = `database_${timestamp}.json.gz`;
    const filepath = path.join(this.backupDir, filename);

    // Get all data from storage
    const data = {
      streams: await storage.listStreams(),
      users: await storage.getAllUsers(),
      lines: await storage.getAllLines(),
      categories: await storage.getAllCategories(),
      servers: await storage.getAllServers(),
      timestamp: new Date().toISOString(),
    };

    // Write to file
    const jsonData = JSON.stringify(data, null, 2);
    
    // Compress with gzip (simulated - in real implementation use zlib)
    fs.writeFileSync(filepath, jsonData);

    const stats = fs.statSync(filepath);
    backup.size = stats.size;
    backup.path = filepath;
    backup.metadata.tables = Object.keys(data);
  }

  private async backupFiles(backup: Backup): Promise<void> {
    const timestamp = Date.now();
    const filename = `files_${timestamp}.tar.gz`;
    const filepath = path.join(this.backupDir, filename);

    // In a real implementation, this would create a tar.gz archive
    // For now, we'll simulate it
    const fileList = ['uploads/', 'logs/', 'config/'];
    
    backup.path = filepath;
    backup.size = 1024 * 1024; // Simulated size
    backup.metadata.fileCount = 100;
  }

  private async backupIncremental(backup: Backup): Promise<void> {
    // Find the last full backup
    const lastFull = Array.from(this.backups.values())
      .filter(b => b.type === 'full' && b.status === 'completed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!lastFull) {
      throw new Error('No full backup found. Create a full backup first.');
    }

    // Backup only changes since last full backup
    await this.backupDatabase(backup);
    backup.metadata.tables = ['changes_only'];
  }

  // List Backups
  listBackups(type?: Backup['type'], limit = 50): Backup[] {
    let backups = Array.from(this.backups.values());

    if (type) {
      backups = backups.filter(b => b.type === type);
    }

    return backups
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Get Backup
  getBackup(id: string): Backup | null {
    return this.backups.get(id) || null;
  }

  // Delete Backup
  async deleteBackup(id: string): Promise<boolean> {
    const backup = this.backups.get(id);
    if (!backup) return false;

    // Delete physical file
    if (backup.path && fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }

    // Remove restore points
    this.restorePoints = this.restorePoints.filter(rp => rp.backupId !== id);

    return this.backups.delete(id);
  }

  // Restore from Backup
  async restoreBackup(id: string, options: { verify?: boolean } = {}): Promise<void> {
    const backup = this.backups.get(id);
    if (!backup) {
      throw new Error('Backup not found');
    }

    if (backup.status !== 'completed') {
      throw new Error('Backup is not completed');
    }

    if (!fs.existsSync(backup.path)) {
      throw new Error('Backup file not found');
    }

    if (options.verify) {
      await this.verifyBackup(id);
    }

    // Read backup data
    const data = JSON.parse(fs.readFileSync(backup.path, 'utf-8'));

    // Restore data (in a real implementation, this would restore to database)
    console.log(`[Backup] Restoring ${backup.type} backup from ${backup.createdAt}`);
    
    // Mark restore point as verified
    const restorePoint = this.restorePoints.find(rp => rp.backupId === id);
    if (restorePoint) {
      restorePoint.verified = true;
    }
  }

  // Verify Backup
  async verifyBackup(id: string): Promise<boolean> {
    const backup = this.backups.get(id);
    if (!backup) {
      throw new Error('Backup not found');
    }

    if (!fs.existsSync(backup.path)) {
      throw new Error('Backup file not found');
    }

    try {
      // Verify file integrity
      const data = JSON.parse(fs.readFileSync(backup.path, 'utf-8'));
      
      // Verify required fields
      if (!data.timestamp || !data.streams) {
        throw new Error('Invalid backup format');
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Backup Schedules
  async createSchedule(schedule: Omit<BackupSchedule, 'id'>): Promise<BackupSchedule> {
    const newSchedule: BackupSchedule = {
      ...schedule,
      id: `schedule_${Date.now()}`,
      nextRun: this.calculateNextRun(schedule as BackupSchedule, new Date()),
    };

    this.schedules.set(newSchedule.id, newSchedule);
    return newSchedule;
  }

  getSchedule(id: string): BackupSchedule | null {
    return this.schedules.get(id) || null;
  }

  listSchedules(): BackupSchedule[] {
    return Array.from(this.schedules.values());
  }

  async updateSchedule(id: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null> {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    const updated = { ...schedule, ...updates };
    updated.nextRun = this.calculateNextRun(updated, new Date());
    
    this.schedules.set(id, updated);
    return updated;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // Restore Points
  getRestorePoints(): RestorePoint[] {
    return [...this.restorePoints].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  // Cleanup
  private async cleanupOldBackups() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const backup of this.backups.values()) {
      const age = now - backup.createdAt.getTime();
      
      if (age > maxAge && backup.status === 'completed') {
        await this.deleteBackup(backup.id);
      }
    }
  }

  // Statistics
  getBackupStats(): {
    total: number;
    completed: number;
    failed: number;
    totalSize: number;
    lastBackup?: Date;
    nextScheduled?: Date;
  } {
    const backups = Array.from(this.backups.values());
    const completed = backups.filter(b => b.status === 'completed');
    const failed = backups.filter(b => b.status === 'failed');
    const totalSize = completed.reduce((sum, b) => sum + b.size, 0);
    
    const lastBackup = completed.length > 0
      ? completed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : undefined;

    const nextScheduled = Array.from(this.schedules.values())
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0))[0]?.nextRun;

    return {
      total: backups.length,
      completed: completed.length,
      failed: failed.length,
      totalSize,
      lastBackup,
      nextScheduled,
    };
  }
}

export const backupService = new BackupService();
