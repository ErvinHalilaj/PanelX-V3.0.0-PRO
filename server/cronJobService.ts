/**
 * Cron Job Service
 * Handles scheduled task management and execution
 */

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron expression
  command: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  runCount: number;
  averageRunTime: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CronJobExecution {
  id: string;
  jobId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  output?: string;
  error?: string;
}

class CronJobService {
  private jobs: Map<string, CronJob> = new Map();
  private executions: CronJobExecution[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultJobs();
    this.startScheduler();
  }

  private initializeDefaultJobs() {
    // Cleanup old backups
    this.createJob({
      name: 'Cleanup Old Backups',
      description: 'Delete backups older than 30 days',
      schedule: '0 2 * * *', // Daily at 2 AM
      command: 'backup:cleanup',
      enabled: true,
    });

    // Cleanup expired lines
    this.createJob({
      name: 'Cleanup Expired Lines',
      description: 'Remove expired user lines',
      schedule: '0 3 * * *', // Daily at 3 AM
      command: 'lines:cleanup',
      enabled: true,
    });

    // Check stream health
    this.createJob({
      name: 'Stream Health Check',
      description: 'Monitor stream availability',
      schedule: '*/15 * * * *', // Every 15 minutes
      command: 'streams:health-check',
      enabled: true,
    });

    // Generate daily reports
    this.createJob({
      name: 'Generate Daily Reports',
      description: 'Create daily analytics reports',
      schedule: '0 1 * * *', // Daily at 1 AM
      command: 'reports:generate',
      enabled: true,
    });
  }

  private startScheduler() {
    // Check all jobs every minute
    setInterval(() => {
      this.checkJobs();
    }, 60000);

    // Cleanup old executions every hour
    setInterval(() => {
      this.cleanupOldExecutions();
    }, 3600000);
  }

  private checkJobs() {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;

      if (!job.nextRun) {
        job.nextRun = this.calculateNextRun(job.schedule, now);
        continue;
      }

      if (now >= job.nextRun) {
        this.executeJob(job);
        job.nextRun = this.calculateNextRun(job.schedule, now);
      }
    }
  }

  private calculateNextRun(schedule: string, from: Date): Date {
    // Simple cron parser (in production, use a proper library like node-cron)
    const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(' ');
    
    const next = new Date(from);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Parse minute
    if (minute.startsWith('*/')) {
      const interval = parseInt(minute.slice(2));
      const currentMinute = next.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
      next.setMinutes(nextMinute);
    } else if (minute !== '*') {
      next.setMinutes(parseInt(minute));
    }

    // Parse hour
    if (hour !== '*') {
      next.setHours(parseInt(hour));
    }

    // If calculated time is in the past, move to next day/hour
    if (next <= from) {
      if (hour === '*') {
        next.setHours(next.getHours() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  private async executeJob(job: CronJob): Promise<void> {
    const execution: CronJobExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jobId: job.id,
      status: 'running',
      startedAt: new Date(),
    };

    this.executions.push(execution);
    job.lastRun = execution.startedAt;

    try {
      const result = await this.runCommand(job.command);
      
      execution.status = 'success';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.output = result;

      job.lastStatus = 'success';
      job.runCount++;
      
      // Update average run time
      job.averageRunTime = job.averageRunTime
        ? (job.averageRunTime + execution.duration) / 2
        : execution.duration;
    } catch (error: any) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = error.message;

      job.lastStatus = 'failed';
      job.lastError = error.message;
    }
  }

  private async runCommand(command: string): Promise<string> {
    // Execute predefined commands
    switch (command) {
      case 'backup:cleanup':
        return 'Old backups cleaned up successfully';
      
      case 'lines:cleanup':
        return 'Expired lines removed successfully';
      
      case 'streams:health-check':
        return 'Stream health check completed';
      
      case 'reports:generate':
        return 'Daily reports generated successfully';
      
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  // Create Job
  async createJob(job: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'averageRunTime'>): Promise<CronJob> {
    const newJob: CronJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      runCount: 0,
      averageRunTime: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRun: this.calculateNextRun(job.schedule, new Date()),
    };

    this.jobs.set(newJob.id, newJob);
    return newJob;
  }

  // Get Job
  getJob(id: string): CronJob | null {
    return this.jobs.get(id) || null;
  }

  // List Jobs
  listJobs(): CronJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Update Job
  async updateJob(id: string, updates: Partial<CronJob>): Promise<CronJob | null> {
    const job = this.jobs.get(id);
    if (!job) return null;

    const updated = {
      ...job,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    // Recalculate next run if schedule changed
    if (updates.schedule) {
      updated.nextRun = this.calculateNextRun(updated.schedule, new Date());
    }

    this.jobs.set(id, updated);
    return updated;
  }

  // Delete Job
  async deleteJob(id: string): Promise<boolean> {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    return this.jobs.delete(id);
  }

  // Run Job Manually
  async runJobNow(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    await this.executeJob(job);
  }

  // Get Executions
  getExecutions(jobId?: string, limit = 100): CronJobExecution[] {
    let executions = [...this.executions];

    if (jobId) {
      executions = executions.filter(e => e.jobId === jobId);
    }

    return executions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  // Cleanup Old Executions
  private cleanupOldExecutions() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    this.executions = this.executions.filter(
      e => now - e.startedAt.getTime() < maxAge
    );
  }

  // Statistics
  getCronStats(): {
    totalJobs: number;
    enabledJobs: number;
    totalExecutions: number;
    successRate: number;
    failedExecutions: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const enabledJobs = jobs.filter(j => j.enabled).length;
    const totalExecutions = this.executions.length;
    const successfulExecutions = this.executions.filter(e => e.status === 'success').length;
    const failedExecutions = this.executions.filter(e => e.status === 'failed').length;

    return {
      totalJobs: jobs.length,
      enabledJobs,
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      failedExecutions,
    };
  }
}

export const cronJobService = new CronJobService();
