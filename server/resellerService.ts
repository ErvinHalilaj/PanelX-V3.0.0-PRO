/**
 * Reseller Management Service
 * Handles reseller accounts, credits, permissions, and hierarchy
 */

import { storage } from './storage';

interface ResellerAccount {
  id: number;
  username: string;
  email: string;
  credits: number;
  maxCredits: number;
  parentResellerId?: number;
  permissions: ResellerPermission[];
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
}

interface ResellerPermission {
  resource: string; // 'streams', 'lines', 'users', 'bouquets', etc.
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  enabled: boolean;
}

interface CreditTransaction {
  id: number;
  userId: number;
  amount: number;
  type: 'purchase' | 'transfer' | 'refund' | 'deduction' | 'adjustment';
  reason: string;
  referenceId?: string;
  fromUserId?: number;
  toUserId?: number;
  createdAt: Date;
}

interface ResellerStats {
  totalUsers: number;
  activeUsers: number;
  totalLines: number;
  activeLines: number;
  totalStreams: number;
  creditsUsed: number;
  creditsRemaining: number;
  revenue: number;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
}

class ResellerService {
  private creditPackages: Map<string, CreditPackage> = new Map();
  private defaultPermissions: ResellerPermission[] = [
    { resource: 'lines', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['create', 'read', 'update'] },
    { resource: 'streams', actions: ['read'] },
    { resource: 'bouquets', actions: ['read'] },
  ];

  constructor() {
    this.initializeCreditPackages();
  }

  /**
   * Initialize default credit packages
   */
  private initializeCreditPackages(): void {
    const packages: CreditPackage[] = [
      { id: 'starter', name: 'Starter Package', credits: 100, price: 10, description: '100 credits for new resellers', enabled: true },
      { id: 'basic', name: 'Basic Package', credits: 500, price: 45, description: '500 credits - 10% discount', enabled: true },
      { id: 'professional', name: 'Professional Package', credits: 1000, price: 80, description: '1000 credits - 20% discount', enabled: true },
      { id: 'business', name: 'Business Package', credits: 2500, price: 187.5, description: '2500 credits - 25% discount', enabled: true },
      { id: 'enterprise', name: 'Enterprise Package', credits: 5000, price: 350, description: '5000 credits - 30% discount', enabled: true },
    ];

    packages.forEach(pkg => this.creditPackages.set(pkg.id, pkg));
  }

  /**
   * Create reseller account
   */
  async createReseller(
    username: string,
    email: string,
    password: string,
    initialCredits: number = 0,
    maxCredits: number = 10000,
    parentResellerId?: number,
    permissions?: ResellerPermission[]
  ): Promise<ResellerAccount> {
    // Check if parent reseller exists and has enough credits
    if (parentResellerId) {
      const parent = await storage.getUser(parentResellerId);
      if (!parent) {
        throw new Error('Parent reseller not found');
      }
      if (parent.role !== 'reseller' && parent.role !== 'admin') {
        throw new Error('Parent is not a reseller');
      }
    }

    // Create user with reseller role
    const hashedPassword = await this.hashPassword(password);
    const user = await storage.createUser({
      username,
      email: email || `${username}@reseller.local`,
      password: hashedPassword,
      role: 'reseller',
      credits: user.credits || 0,
      maxCredits: user.maxCredits || maxCredits,
      isActive: true,
      parentId: parentResellerId,
      createdBy: 0, // Admin or system
    });

    const resellerAccount: ResellerAccount = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      credits: user.credits || 0,
      maxCredits: user.maxCredits || maxCredits,
      parentResellerId,
      permissions: permissions || this.defaultPermissions,
      status: 'active',
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    };

    return resellerAccount;
  }

  /**
   * Get reseller account
   */
  async getReseller(resellerId: number): Promise<ResellerAccount | null> {
    const user = await storage.getUser(resellerId);
    if (!user || (user.role !== 'reseller' && user.role !== 'admin')) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email || '',
      credits: user.credits || 0,
      maxCredits: user.maxCredits || 10000,
      parentResellerId: user.parentId,
      permissions: this.defaultPermissions, // TODO: Load from DB
      status: user.isActive ? 'active' : 'inactive',
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    };
  }

  /**
   * Update reseller account
   */
  async updateReseller(
    resellerId: number,
    updates: Partial<{
      email: string;
      maxCredits: number;
      permissions: ResellerPermission[];
      status: 'active' | 'suspended' | 'inactive';
    }>
  ): Promise<ResellerAccount | null> {
    const user = await storage.getUser(resellerId);
    if (!user) return null;

    await storage.updateUser(resellerId, {
      ...user,
      email: updates.email || user.email,
      maxCredits: updates.maxCredits || user.maxCredits,
      isActive: updates.status === 'active',
    });

    return this.getReseller(resellerId);
  }

  /**
   * List resellers
   */
  async listResellers(parentResellerId?: number): Promise<ResellerAccount[]> {
    const users = await storage.getUsers();
    const resellers = users.filter(u => 
      (u.role === 'reseller' || u.role === 'admin') &&
      (!parentResellerId || u.parentId === parentResellerId)
    );

    return resellers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email || '',
      credits: u.credits || 0,
      maxCredits: u.maxCredits || 10000,
      parentResellerId: u.parentId,
      permissions: this.defaultPermissions,
      status: u.isActive ? 'active' : 'inactive',
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
    }));
  }

  /**
   * Add credits to reseller
   */
  async addCredits(
    resellerId: number,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<{ success: boolean; newBalance: number }> {
    const user = await storage.getUser(resellerId);
    if (!user) {
      throw new Error('Reseller not found');
    }

    const currentCredits = user.credits || 0;
    const maxCredits = user.maxCredits || 10000;
    const newBalance = Math.min(currentCredits + amount, maxCredits);

    await storage.updateUser(resellerId, {
      ...user,
      credits: newBalance,
    });

    // Record transaction
    await storage.createCreditTransaction({
      userId: resellerId,
      amount,
      reason,
      referenceId,
    });

    return { success: true, newBalance };
  }

  /**
   * Deduct credits from reseller
   */
  async deductCredits(
    resellerId: number,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<{ success: boolean; newBalance: number }> {
    const user = await storage.getUser(resellerId);
    if (!user) {
      throw new Error('Reseller not found');
    }

    const currentCredits = user.credits || 0;
    if (currentCredits < amount) {
      throw new Error('Insufficient credits');
    }

    const newBalance = currentCredits - amount;

    await storage.updateUser(resellerId, {
      ...user,
      credits: newBalance,
    });

    // Record transaction
    await storage.createCreditTransaction({
      userId: resellerId,
      amount: -amount,
      reason,
      referenceId,
    });

    return { success: true, newBalance };
  }

  /**
   * Transfer credits between resellers
   */
  async transferCredits(
    fromResellerId: number,
    toResellerId: number,
    amount: number,
    reason: string = 'Credit transfer'
  ): Promise<{ success: boolean; fromBalance: number; toBalance: number }> {
    // Validate both resellers exist
    const fromUser = await storage.getUser(fromResellerId);
    const toUser = await storage.getUser(toResellerId);

    if (!fromUser || !toUser) {
      throw new Error('One or both resellers not found');
    }

    const fromCredits = fromUser.credits || 0;
    if (fromCredits < amount) {
      throw new Error('Insufficient credits');
    }

    // Deduct from sender
    await this.deductCredits(fromResellerId, amount, `Transfer to ${toUser.username}`, `transfer_${Date.now()}`);

    // Add to receiver
    await this.addCredits(toResellerId, amount, `Transfer from ${fromUser.username}`, `transfer_${Date.now()}`);

    return {
      success: true,
      fromBalance: fromCredits - amount,
      toBalance: (toUser.credits || 0) + amount,
    };
  }

  /**
   * Get credit packages
   */
  getCreditPackages(): CreditPackage[] {
    return Array.from(this.creditPackages.values()).filter(pkg => pkg.enabled);
  }

  /**
   * Purchase credit package
   */
  async purchasePackage(
    resellerId: number,
    packageId: string,
    paymentReference: string
  ): Promise<{ success: boolean; newBalance: number }> {
    const pkg = this.creditPackages.get(packageId);
    if (!pkg || !pkg.enabled) {
      throw new Error('Package not found or disabled');
    }

    return await this.addCredits(
      resellerId,
      pkg.credits,
      `Purchased ${pkg.name}`,
      paymentReference
    );
  }

  /**
   * Get reseller statistics
   */
  async getResellerStats(resellerId: number): Promise<ResellerStats> {
    const reseller = await storage.getUser(resellerId);
    if (!reseller) {
      throw new Error('Reseller not found');
    }

    // Get users created by this reseller
    const allUsers = await storage.getUsers();
    const resellerUsers = allUsers.filter(u => u.parentId === resellerId);
    const activeUsers = resellerUsers.filter(u => u.isActive).length;

    // Get lines created by this reseller or their users
    const allLines = await storage.getLines();
    const resellerLines = allLines.filter(l => 
      l.userId === resellerId || resellerUsers.some(u => u.id === l.userId)
    );
    const activeLines = resellerLines.filter(l => {
      if (!l.expDate) return true;
      return new Date(l.expDate) > new Date();
    }).length;

    // Get streams (if reseller can manage them)
    const streams = await storage.getStreams();

    // Calculate credits
    const creditsUsed = (reseller.maxCredits || 10000) - (reseller.credits || 0);
    const creditsRemaining = reseller.credits || 0;

    // Calculate revenue (simplified: lines × 5 credits each)
    const revenue = resellerLines.length * 5;

    // Recent activity (last 10 transactions)
    const transactions = await storage.getCreditTransactions();
    const recentTransactions = transactions
      .filter(t => t.userId === resellerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const recentActivity = recentTransactions.map(t => ({
      type: t.amount > 0 ? 'credit_add' : 'credit_deduct',
      description: t.reason || 'Credit transaction',
      timestamp: new Date(t.createdAt),
    }));

    return {
      totalUsers: resellerUsers.length,
      activeUsers,
      totalLines: resellerLines.length,
      activeLines,
      totalStreams: streams.length,
      creditsUsed,
      creditsRemaining,
      revenue,
      recentActivity,
    };
  }

  /**
   * Check if reseller has permission
   */
  hasPermission(
    reseller: ResellerAccount,
    resource: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): boolean {
    const permission = reseller.permissions.find(p => p.resource === resource);
    if (!permission) return false;
    return permission.actions.includes(action);
  }

  /**
   * Get reseller hierarchy (parent and children)
   */
  async getResellerHierarchy(resellerId: number): Promise<{
    parent: ResellerAccount | null;
    children: ResellerAccount[];
  }> {
    const reseller = await this.getReseller(resellerId);
    if (!reseller) {
      throw new Error('Reseller not found');
    }

    const parent = reseller.parentResellerId
      ? await this.getReseller(reseller.parentResellerId)
      : null;

    const children = await this.listResellers(resellerId);

    return { parent, children };
  }

  /**
   * Calculate credit cost for operation
   */
  calculateCreditCost(operation: string, quantity: number = 1): number {
    const costs: Record<string, number> = {
      line_create: 5,
      line_extend: 3,
      user_create: 2,
      stream_create: 10,
      bouquet_create: 5,
    };

    return (costs[operation] || 1) * quantity;
  }

  /**
   * Hash password (placeholder - use bcrypt in production)
   */
  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
  }
}

// Singleton instance
export const resellerService = new ResellerService();
