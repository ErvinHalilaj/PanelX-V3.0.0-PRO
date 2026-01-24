/**
 * Webhook Service
 * Handles webhook management, delivery, and retry logic
 */

import axios from 'axios';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  enabled: boolean;
  headers?: Record<string, string>;
  retryAttempts: number;
  timeout: number;
  createdAt: Date;
  lastTriggered?: Date;
}

type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'line.created'
  | 'line.expired'
  | 'stream.online'
  | 'stream.offline'
  | 'backup.completed'
  | 'backup.failed'
  | 'payment.received'
  | 'credit.low';

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  response?: {
    status: number;
    body: string;
  };
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

class WebhookService {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: WebhookDelivery[] = [];
  private deliveryQueue: WebhookDelivery[] = [];
  private isProcessing = false;

  constructor() {
    this.startDeliveryProcessor();
  }

  private startDeliveryProcessor() {
    setInterval(() => {
      this.processDeliveryQueue();
    }, 5000); // Process every 5 seconds

    // Cleanup old deliveries every hour
    setInterval(() => {
      this.cleanupOldDeliveries();
    }, 3600000);
  }

  // Create Webhook
  async createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt'>): Promise<Webhook> {
    const newWebhook: Webhook = {
      ...webhook,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    this.webhooks.set(newWebhook.id, newWebhook);
    return newWebhook;
  }

  // Get Webhook
  getWebhook(id: string): Webhook | null {
    return this.webhooks.get(id) || null;
  }

  // List Webhooks
  listWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Update Webhook
  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    const updated = { ...webhook, ...updates, id };
    this.webhooks.set(id, updated);
    return updated;
  }

  // Delete Webhook
  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  // Trigger Event
  async triggerEvent(event: WebhookEvent, payload: any): Promise<void> {
    const webhooks = Array.from(this.webhooks.values())
      .filter(w => w.enabled && w.events.includes(event));

    for (const webhook of webhooks) {
      const delivery: WebhookDelivery = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        webhookId: webhook.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };

      this.deliveries.push(delivery);
      this.deliveryQueue.push(delivery);
      
      // Update last triggered
      webhook.lastTriggered = new Date();
    }
  }

  // Process Delivery Queue
  private async processDeliveryQueue() {
    if (this.isProcessing || this.deliveryQueue.length === 0) return;

    this.isProcessing = true;

    const delivery = this.deliveryQueue.shift();
    if (!delivery) {
      this.isProcessing = false;
      return;
    }

    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || !webhook.enabled) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found or disabled';
      this.isProcessing = false;
      return;
    }

    try {
      await this.deliverWebhook(webhook, delivery);
    } catch (error: any) {
      console.error(`[Webhook] Delivery failed:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Deliver Webhook
  private async deliverWebhook(webhook: Webhook, delivery: WebhookDelivery): Promise<void> {
    delivery.attempts++;
    delivery.status = 'retrying';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'PanelX-Webhook/1.0',
        'X-Webhook-Event': delivery.event,
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': delivery.id,
        ...webhook.headers,
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        const signature = this.generateSignature(delivery.payload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await axios.post(webhook.url, delivery.payload, {
        headers,
        timeout: webhook.timeout || 30000,
      });

      delivery.status = 'success';
      delivery.response = {
        status: response.status,
        body: JSON.stringify(response.data),
      };
      delivery.deliveredAt = new Date();
    } catch (error: any) {
      delivery.status = 'failed';
      delivery.error = error.message;

      // Retry if attempts < max retries
      if (delivery.attempts < webhook.retryAttempts) {
        delivery.status = 'retrying';
        
        // Exponential backoff
        const delay = Math.pow(2, delivery.attempts) * 1000;
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
        }, delay);
      }
    }
  }

  // Generate Signature
  private generateSignature(payload: any, secret: string): string {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Get Deliveries
  getDeliveries(webhookId?: string, limit = 100): WebhookDelivery[] {
    let deliveries = [...this.deliveries];

    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === webhookId);
    }

    return deliveries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Retry Delivery
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.find(d => d.id === deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    delivery.status = 'pending';
    delivery.attempts = 0;
    this.deliveryQueue.push(delivery);
  }

  // Cleanup Old Deliveries
  private cleanupOldDeliveries() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    this.deliveries = this.deliveries.filter(
      d => now - d.createdAt.getTime() < maxAge
    );
  }

  // Statistics
  getWebhookStats(webhookId: string): {
    totalDeliveries: number;
    successRate: number;
    failedDeliveries: number;
    averageResponseTime: number;
  } {
    const deliveries = this.deliveries.filter(d => d.webhookId === webhookId);
    const successful = deliveries.filter(d => d.status === 'success').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;

    return {
      totalDeliveries: deliveries.length,
      successRate: deliveries.length > 0 ? (successful / deliveries.length) * 100 : 0,
      failedDeliveries: failed,
      averageResponseTime: 0, // Would calculate from actual response times
    };
  }
}

export const webhookService = new WebhookService();
