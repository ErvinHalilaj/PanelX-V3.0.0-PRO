/**
 * Schedule Manager
 * Handles automatic stream start/stop based on schedules
 */

import { CronJob } from 'cron';
import type { Stream } from '@shared/schema';

export interface StreamSchedule {
  id: number;
  streamId: number;
  scheduleType: 'once' | 'daily' | 'weekly' | 'custom';
  startTime?: string; // HH:MM format
  stopTime?: string; // HH:MM format
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  timezone: string;
  enabled: boolean;
  action: 'start' | 'stop' | 'both';
  cronExpression?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleJob {
  schedule: StreamSchedule;
  startJob?: CronJob;
  stopJob?: CronJob;
}

class ScheduleManager {
  private jobs: Map<number, ScheduleJob>;
  private storage: any; // Storage interface

  constructor() {
    this.jobs = new Map();
  }

  /**
   * Initialize with storage
   */
  setStorage(storage: any) {
    this.storage = storage;
  }

  /**
   * Load and start all enabled schedules
   */
  async loadSchedules(): Promise<void> {
    if (!this.storage) {
      console.error('[ScheduleManager] Storage not initialized');
      return;
    }

    try {
      // Get all enabled schedules from database
      const schedules = await this.storage.getSchedules({ enabled: true });
      
      for (const schedule of schedules) {
        await this.createScheduleJob(schedule);
      }

      console.log(`[ScheduleManager] Loaded ${schedules.length} schedules`);
    } catch (error) {
      console.error('[ScheduleManager] Failed to load schedules:', error);
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: Omit<StreamSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<StreamSchedule> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    // Validate schedule
    this.validateSchedule(schedule);

    // Check for conflicts
    const conflicts = await this.checkConflicts(schedule);
    if (conflicts.length > 0) {
      throw new Error(`Schedule conflicts with existing schedules: ${conflicts.map(c => c.id).join(', ')}`);
    }

    // Save to database
    const created = await this.storage.createSchedule(schedule);

    // Create cron jobs if enabled
    if (created.enabled) {
      await this.createScheduleJob(created);
    }

    return created;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(id: number, updates: Partial<StreamSchedule>): Promise<StreamSchedule> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    // Stop existing jobs
    this.stopScheduleJob(id);

    // Update in database
    const updated = await this.storage.updateSchedule(id, updates);

    // Restart jobs if enabled
    if (updated.enabled) {
      await this.createScheduleJob(updated);
    }

    return updated;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    // Stop jobs
    this.stopScheduleJob(id);

    // Delete from database
    await this.storage.deleteSchedule(id);
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(id: number): Promise<StreamSchedule | null> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    return this.storage.getSchedule(id);
  }

  /**
   * Get all schedules for a stream
   */
  async getStreamSchedules(streamId: number): Promise<StreamSchedule[]> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    return this.storage.getSchedules({ streamId });
  }

  /**
   * Get all schedules
   */
  async getAllSchedules(): Promise<StreamSchedule[]> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    return this.storage.getSchedules();
  }

  /**
   * Create cron jobs for a schedule
   */
  private async createScheduleJob(schedule: StreamSchedule): Promise<void> {
    const job: ScheduleJob = { schedule };

    // Create start job
    if (schedule.action === 'start' || schedule.action === 'both') {
      const startCron = this.generateCronExpression(schedule, 'start');
      if (startCron) {
        job.startJob = new CronJob(
          startCron,
          () => this.executeScheduleAction(schedule.streamId, 'start'),
          null,
          true,
          schedule.timezone
        );
      }
    }

    // Create stop job
    if (schedule.action === 'stop' || schedule.action === 'both') {
      const stopCron = this.generateCronExpression(schedule, 'stop');
      if (stopCron) {
        job.stopJob = new CronJob(
          stopCron,
          () => this.executeScheduleAction(schedule.streamId, 'stop'),
          null,
          true,
          schedule.timezone
        );
      }
    }

    this.jobs.set(schedule.id, job);
    console.log(`[ScheduleManager] Created schedule job for stream ${schedule.streamId}`);
  }

  /**
   * Stop and remove schedule jobs
   */
  private stopScheduleJob(scheduleId: number): void {
    const job = this.jobs.get(scheduleId);
    if (job) {
      if (job.startJob) {
        job.startJob.stop();
      }
      if (job.stopJob) {
        job.stopJob.stop();
      }
      this.jobs.delete(scheduleId);
      console.log(`[ScheduleManager] Stopped schedule job ${scheduleId}`);
    }
  }

  /**
   * Generate cron expression from schedule
   */
  private generateCronExpression(schedule: StreamSchedule, action: 'start' | 'stop'): string | null {
    const time = action === 'start' ? schedule.startTime : schedule.stopTime;
    if (!time) return null;

    const [hours, minutes] = time.split(':').map(Number);

    switch (schedule.scheduleType) {
      case 'once':
        // One-time schedule (will be handled separately)
        return null;

      case 'daily':
        // Every day at specified time
        return `${minutes} ${hours} * * *`;

      case 'weekly':
        // Specific days of week at specified time
        if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
          return `${minutes} ${hours} * * *`;
        }
        return `${minutes} ${hours} * * ${schedule.daysOfWeek.join(',')}`;

      case 'custom':
        // Use provided cron expression
        return schedule.cronExpression || null;

      default:
        return null;
    }
  }

  /**
   * Execute scheduled action (start/stop stream)
   */
  private async executeScheduleAction(streamId: number, action: 'start' | 'stop'): Promise<void> {
    try {
      console.log(`[ScheduleManager] Executing ${action} for stream ${streamId}`);

      // Import FFmpeg manager dynamically
      const { getFfmpegManager } = await import('./ffmpegManager');
      const ffmpegManager = getFfmpegManager();

      if (!ffmpegManager) {
        console.error('[ScheduleManager] FFmpeg manager not available');
        return;
      }

      if (action === 'start') {
        // Get stream details
        const stream = await this.storage.getStream(streamId);
        if (!stream) {
          console.error(`[ScheduleManager] Stream ${streamId} not found`);
          return;
        }

        // Start stream
        await ffmpegManager.startStream(stream);
        console.log(`[ScheduleManager] Started stream ${streamId}`);
      } else {
        // Stop stream
        await ffmpegManager.stopStream(streamId);
        console.log(`[ScheduleManager] Stopped stream ${streamId}`);
      }
    } catch (error) {
      console.error(`[ScheduleManager] Failed to execute ${action} for stream ${streamId}:`, error);
    }
  }

  /**
   * Validate schedule configuration
   */
  private validateSchedule(schedule: Partial<StreamSchedule>): void {
    if (!schedule.streamId) {
      throw new Error('Stream ID is required');
    }

    if (!schedule.scheduleType) {
      throw new Error('Schedule type is required');
    }

    if (!schedule.action) {
      throw new Error('Action is required');
    }

    if (schedule.action === 'start' || schedule.action === 'both') {
      if (!schedule.startTime) {
        throw new Error('Start time is required for start action');
      }
    }

    if (schedule.action === 'stop' || schedule.action === 'both') {
      if (!schedule.stopTime) {
        throw new Error('Stop time is required for stop action');
      }
    }

    if (schedule.scheduleType === 'weekly' && (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0)) {
      throw new Error('Days of week are required for weekly schedules');
    }

    if (schedule.scheduleType === 'custom' && !schedule.cronExpression) {
      throw new Error('Cron expression is required for custom schedules');
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (schedule.startTime && !timeRegex.test(schedule.startTime)) {
      throw new Error('Invalid start time format. Use HH:MM (24-hour)');
    }
    if (schedule.stopTime && !timeRegex.test(schedule.stopTime)) {
      throw new Error('Invalid stop time format. Use HH:MM (24-hour)');
    }
  }

  /**
   * Check for schedule conflicts
   */
  private async checkConflicts(schedule: Partial<StreamSchedule>): Promise<StreamSchedule[]> {
    if (!this.storage || !schedule.streamId) {
      return [];
    }

    // Get existing schedules for the stream
    const existing = await this.storage.getSchedules({ 
      streamId: schedule.streamId,
      enabled: true 
    });

    // Check for time overlaps
    const conflicts: StreamSchedule[] = [];

    for (const existingSchedule of existing) {
      if (this.hasTimeOverlap(schedule, existingSchedule)) {
        conflicts.push(existingSchedule);
      }
    }

    return conflicts;
  }

  /**
   * Check if two schedules have time overlap
   */
  private hasTimeOverlap(schedule1: Partial<StreamSchedule>, schedule2: StreamSchedule): boolean {
    // For simplicity, check if they have the same schedule type and overlapping times
    if (schedule1.scheduleType !== schedule2.scheduleType) {
      return false;
    }

    if (schedule1.scheduleType === 'weekly') {
      // Check if they share any days of week
      const days1 = schedule1.daysOfWeek || [];
      const days2 = schedule2.daysOfWeek || [];
      const sharedDays = days1.filter(d => days2.includes(d));
      if (sharedDays.length === 0) {
        return false;
      }
    }

    // Check time overlap
    const start1 = schedule1.startTime || '00:00';
    const stop1 = schedule1.stopTime || '23:59';
    const start2 = schedule2.startTime || '00:00';
    const stop2 = schedule2.stopTime || '23:59';

    return (start1 < stop2 && stop1 > start2);
  }

  /**
   * Get next scheduled action
   */
  getNextScheduledAction(streamId: number): { action: string; time: Date } | null {
    // Find all jobs for this stream
    const streamJobs = Array.from(this.jobs.values()).filter(
      job => job.schedule.streamId === streamId
    );

    if (streamJobs.length === 0) {
      return null;
    }

    let nextAction: { action: string; time: Date } | null = null;
    let minTime = Number.MAX_VALUE;

    for (const job of streamJobs) {
      if (job.startJob) {
        const nextStart = job.startJob.nextDate();
        if (nextStart && nextStart.getTime() < minTime) {
          minTime = nextStart.getTime();
          nextAction = { action: 'start', time: nextStart.toDate() };
        }
      }

      if (job.stopJob) {
        const nextStop = job.stopJob.nextDate();
        if (nextStop && nextStop.getTime() < minTime) {
          minTime = nextStop.getTime();
          nextAction = { action: 'stop', time: nextStop.toDate() };
        }
      }
    }

    return nextAction;
  }
}

// Singleton instance
export const scheduleManager = new ScheduleManager();
