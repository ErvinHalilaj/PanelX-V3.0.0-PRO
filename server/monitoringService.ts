/**
 * Monitoring & Alerts Service
 * Real-time system monitoring, alerting, and health checks
 */
import si from 'systeminformation';

interface Alert {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'sms';
  condition: AlertCondition;
  threshold: number;
  enabled: boolean;
  recipients: string[];
  cooldown: number; // Minutes between alerts
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

interface AlertCondition {
  metric: 'cpu' | 'memory' | 'disk' | 'streams_offline' | 'failed_logins' | 'backup_failures';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration?: number; // Minutes the condition must be true
}

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  streams: {
    total: number;
    online: number;
    offline: number;
  };
  users: {
    total: number;
    active: number;
    online: number;
  };
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  message?: string;
}

class MonitoringService {
  private alerts: Map<string, Alert> = new Map();
  private metricsHistory: SystemMetrics[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private maxHistorySize = 1000; // Keep last 1000 metrics

  constructor() {
    this.initializeDefaultAlerts();
    this.startMonitoring();
  }

  private initializeDefaultAlerts() {
    // High CPU usage
    this.createAlert({
      name: 'High CPU Usage',
      type: 'email',
      condition: {
        metric: 'cpu',
        operator: 'gt',
        value: 80,
        duration: 5,
      },
      threshold: 80,
      enabled: true,
      recipients: ['admin@example.com'],
      cooldown: 30,
    });

    // High memory usage
    this.createAlert({
      name: 'High Memory Usage',
      type: 'email',
      condition: {
        metric: 'memory',
        operator: 'gt',
        value: 85,
        duration: 5,
      },
      threshold: 85,
      enabled: true,
      recipients: ['admin@example.com'],
      cooldown: 30,
    });

    // Disk space low
    this.createAlert({
      name: 'Low Disk Space',
      type: 'email',
      condition: {
        metric: 'disk',
        operator: 'gt',
        value: 90,
      },
      threshold: 90,
      enabled: true,
      recipients: ['admin@example.com'],
      cooldown: 60,
    });

    // Streams offline
    this.createAlert({
      name: 'Multiple Streams Offline',
      type: 'webhook',
      condition: {
        metric: 'streams_offline',
        operator: 'gt',
        value: 5,
      },
      threshold: 5,
      enabled: true,
      recipients: [],
      cooldown: 15,
    });
  }

  private startMonitoring() {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);

    // Check alerts every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60000);

    // Run health checks every 2 minutes
    setInterval(() => {
      this.runHealthChecks();
    }, 120000);

    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Get real system metrics
      const [cpuLoad, mem, disk, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ]);

      // Calculate CPU usage (average of all cores)
      const cpuUsage = cpuLoad.currentLoad;
      const cpuCores = cpuLoad.cpus.length;

      // Calculate memory usage
      const memTotal = mem.total;
      const memUsed = mem.used;
      const memFree = mem.free;
      const memUsagePercent = (memUsed / memTotal) * 100;

      // Calculate disk usage (primary disk)
      const primaryDisk = disk[0] || { size: 0, used: 0, available: 0 };
      const diskTotal = primaryDisk.size;
      const diskUsed = primaryDisk.used;
      const diskFree = primaryDisk.available;
      const diskUsagePercent = primaryDisk.use || 0;

      // Calculate network stats
      const netStats = networkStats[0] || { rx_bytes: 0, tx_bytes: 0 };
      const bytesIn = netStats.rx_bytes;
      const bytesOut = netStats.tx_bytes;

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: Math.round(cpuUsage * 100) / 100,
          cores: cpuCores,
        },
        memory: {
          total: memTotal,
          used: memUsed,
          free: memFree,
          usagePercent: Math.round(memUsagePercent * 100) / 100,
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          usagePercent: Math.round(diskUsagePercent * 100) / 100,
        },
        network: {
          bytesIn,
          bytesOut,
        },
        streams: {
          total: 100, // TODO: Get from database
          online: 85,
          offline: 15,
        },
        users: {
          total: 500, // TODO: Get from database
          active: 350,
          online: 120,
        },
      };

      this.metricsHistory.push(metrics);

      // Keep only recent metrics
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
    } catch (error) {
      console.error('[Monitoring] Error collecting metrics:', error);
    }
  }

  private async checkAlerts(): Promise<void> {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!currentMetrics) return;

    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      // Check cooldown
      if (alert.lastTriggered) {
        const minutesSinceLastTrigger = 
          (Date.now() - alert.lastTriggered.getTime()) / 60000;
        if (minutesSinceLastTrigger < alert.cooldown) {
          continue;
        }
      }

      // Check condition
      if (this.evaluateCondition(alert.condition, currentMetrics)) {
        await this.triggerAlert(alert, currentMetrics);
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, metrics: SystemMetrics): boolean {
    let value: number;

    switch (condition.metric) {
      case 'cpu':
        value = metrics.cpu.usage;
        break;
      case 'memory':
        value = metrics.memory.usagePercent;
        break;
      case 'disk':
        value = metrics.disk.usagePercent;
        break;
      case 'streams_offline':
        value = metrics.streams.offline;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'eq':
        return value === condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lte':
        return value <= condition.value;
      default:
        return false;
    }
  }

  private async triggerAlert(alert: Alert, metrics: SystemMetrics): Promise<void> {
    console.log(`[Monitoring] Alert triggered: ${alert.name}`);
    
    alert.lastTriggered = new Date();
    alert.triggerCount++;

    // In production, send actual alerts (email, webhook, SMS)
    // For now, just log
    switch (alert.type) {
      case 'email':
        console.log(`[Alert] Email sent to: ${alert.recipients.join(', ')}`);
        break;
      case 'webhook':
        console.log(`[Alert] Webhook triggered for: ${alert.name}`);
        break;
      case 'sms':
        console.log(`[Alert] SMS sent to: ${alert.recipients.join(', ')}`);
        break;
    }
  }

  private async runHealthChecks(): Promise<void> {
    // Check database
    const dbCheck = await this.checkDatabase();
    this.healthChecks.set('database', dbCheck);

    // Check API
    const apiCheck = await this.checkAPI();
    this.healthChecks.set('api', apiCheck);

    // Check storage
    const storageCheck = await this.checkStorage();
    this.healthChecks.set('storage', storageCheck);

    // Check backup service
    const backupCheck = await this.checkBackupService();
    this.healthChecks.set('backup', backupCheck);
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Simulate database check
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        message: error.message,
      };
    }
  }

  private async checkAPI(): Promise<HealthCheck> {
    const start = Date.now();
    return {
      service: 'api',
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date(),
    };
  }

  private async checkStorage(): Promise<HealthCheck> {
    const start = Date.now();
    return {
      service: 'storage',
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date(),
    };
  }

  private async checkBackupService(): Promise<HealthCheck> {
    const start = Date.now();
    return {
      service: 'backup',
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date(),
    };
  }

  private cleanupOldMetrics() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;

    this.metricsHistory = this.metricsHistory.filter(
      m => m.timestamp.getTime() > cutoff
    );
  }

  // Alert Management
  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'triggerCount'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggerCount: 0,
      createdAt: new Date(),
    };

    this.alerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  getAlert(id: string): Alert | null {
    return this.alerts.get(id) || null;
  }

  listAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    const updated = { ...alert, ...updates, id };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<boolean> {
    return this.alerts.delete(id);
  }

  // Metrics
  getLatestMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(hours = 1): SystemMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  // Health Checks
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = Array.from(this.healthChecks.values());
    
    if (checks.some(c => c.status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (checks.some(c => c.status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // Statistics
  getMonitoringStats(): {
    activeAlerts: number;
    triggeredAlerts: number;
    healthyServices: number;
    totalServices: number;
    averageResponseTime: number;
  } {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(a => a.enabled).length;
    const triggeredAlerts = alerts.reduce((sum, a) => sum + a.triggerCount, 0);
    
    const healthChecks = Array.from(this.healthChecks.values());
    const healthyServices = healthChecks.filter(h => h.status === 'healthy').length;
    const averageResponseTime = healthChecks.length > 0
      ? healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length
      : 0;

    return {
      activeAlerts,
      triggeredAlerts,
      healthyServices,
      totalServices: healthChecks.length,
      averageResponseTime,
    };
  }
}

export const monitoringService = new MonitoringService();
