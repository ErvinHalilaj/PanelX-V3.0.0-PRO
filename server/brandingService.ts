/**
 * Branding & Customization Service
 * Handles white-labeling, themes, logos, and custom branding for resellers
 */

import storage from './storage';

interface BrandingConfig {
  id: string;
  userId: number;
  companyName: string;
  logo?: string; // URL or base64
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBackgroundImage?: string;
  customCss?: string;
  emailTemplates: {
    welcome?: string;
    passwordReset?: string;
    invoiceEmail?: string;
  };
  portalSettings: {
    showPoweredBy: boolean;
    customDomain?: string;
    customFooterText?: string;
    hideAdminBranding: boolean;
  };
  features: {
    customPlayerLogo: boolean;
    customSplashScreen: boolean;
    customLoadingScreen: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: string;
  isDark: boolean;
}

interface CustomPage {
  id: string;
  userId: number;
  slug: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class BrandingService {
  private brandingConfigs: Map<number, BrandingConfig> = new Map();
  private themes: Map<string, Theme> = new Map();
  private customPages: Map<string, CustomPage> = new Map();

  constructor() {
    this.initializeDefaultThemes();
  }

  private initializeDefaultThemes() {
    // Professional Theme
    this.themes.set('professional', {
      id: 'professional',
      name: 'Professional',
      colors: {
        primary: '#3b82f6',
        secondary: '#6366f1',
        accent: '#8b5cf6',
        background: '#ffffff',
        foreground: '#1f2937',
        muted: '#f3f4f6',
        border: '#e5e7eb',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      borderRadius: '0.5rem',
      isDark: false,
    });

    // Dark Professional Theme
    this.themes.set('professional-dark', {
      id: 'professional-dark',
      name: 'Professional Dark',
      colors: {
        primary: '#3b82f6',
        secondary: '#6366f1',
        accent: '#8b5cf6',
        background: '#0f172a',
        foreground: '#f1f5f9',
        muted: '#1e293b',
        border: '#334155',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      borderRadius: '0.5rem',
      isDark: true,
    });

    // Modern Theme
    this.themes.set('modern', {
      id: 'modern',
      name: 'Modern',
      colors: {
        primary: '#10b981',
        secondary: '#14b8a6',
        accent: '#06b6d4',
        background: '#ffffff',
        foreground: '#111827',
        muted: '#f9fafb',
        border: '#d1d5db',
      },
      fonts: {
        heading: 'Poppins, sans-serif',
        body: 'Roboto, sans-serif',
      },
      borderRadius: '1rem',
      isDark: false,
    });

    // Minimal Theme
    this.themes.set('minimal', {
      id: 'minimal',
      name: 'Minimal',
      colors: {
        primary: '#000000',
        secondary: '#404040',
        accent: '#737373',
        background: '#ffffff',
        foreground: '#000000',
        muted: '#fafafa',
        border: '#e5e5e5',
      },
      fonts: {
        heading: 'Helvetica Neue, sans-serif',
        body: 'Helvetica Neue, sans-serif',
      },
      borderRadius: '0.25rem',
      isDark: false,
    });
  }

  // Branding Configuration
  async createBrandingConfig(userId: number, config: Partial<BrandingConfig>): Promise<BrandingConfig> {
    const brandingConfig: BrandingConfig = {
      id: `brand_${userId}_${Date.now()}`,
      userId,
      companyName: config.companyName || 'My Company',
      logo: config.logo,
      favicon: config.favicon,
      primaryColor: config.primaryColor || '#3b82f6',
      secondaryColor: config.secondaryColor || '#6366f1',
      accentColor: config.accentColor || '#8b5cf6',
      loginBackgroundImage: config.loginBackgroundImage,
      customCss: config.customCss,
      emailTemplates: config.emailTemplates || {},
      portalSettings: {
        showPoweredBy: config.portalSettings?.showPoweredBy ?? true,
        customDomain: config.portalSettings?.customDomain,
        customFooterText: config.portalSettings?.customFooterText,
        hideAdminBranding: config.portalSettings?.hideAdminBranding ?? false,
      },
      features: {
        customPlayerLogo: config.features?.customPlayerLogo ?? false,
        customSplashScreen: config.features?.customSplashScreen ?? false,
        customLoadingScreen: config.features?.customLoadingScreen ?? false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.brandingConfigs.set(userId, brandingConfig);
    return brandingConfig;
  }

  async getBrandingConfig(userId: number): Promise<BrandingConfig | null> {
    return this.brandingConfigs.get(userId) || null;
  }

  async updateBrandingConfig(
    userId: number,
    updates: Partial<BrandingConfig>
  ): Promise<BrandingConfig | null> {
    const existing = this.brandingConfigs.get(userId);
    if (!existing) return null;

    const updated: BrandingConfig = {
      ...existing,
      ...updates,
      userId, // Preserve userId
      id: existing.id, // Preserve id
      updatedAt: new Date(),
    };

    this.brandingConfigs.set(userId, updated);
    return updated;
  }

  async deleteBrandingConfig(userId: number): Promise<boolean> {
    return this.brandingConfigs.delete(userId);
  }

  // Theme Management
  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  getTheme(id: string): Theme | null {
    return this.themes.get(id) || null;
  }

  async createCustomTheme(theme: Omit<Theme, 'id'>): Promise<Theme> {
    const id = `custom_${Date.now()}`;
    const customTheme = { ...theme, id };
    this.themes.set(id, customTheme);
    return customTheme;
  }

  async updateTheme(id: string, updates: Partial<Theme>): Promise<Theme | null> {
    const existing = this.themes.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, id }; // Preserve id
    this.themes.set(id, updated);
    return updated;
  }

  async deleteTheme(id: string): Promise<boolean> {
    // Don't allow deletion of default themes
    if (
      ['professional', 'professional-dark', 'modern', 'minimal'].includes(id)
    ) {
      return false;
    }
    return this.themes.delete(id);
  }

  // Custom Pages
  async createCustomPage(
    userId: number,
    page: Omit<CustomPage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomPage> {
    const customPage: CustomPage = {
      ...page,
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.customPages.set(customPage.id, customPage);
    return customPage;
  }

  async getCustomPage(id: string): Promise<CustomPage | null> {
    return this.customPages.get(id) || null;
  }

  async getCustomPageBySlug(userId: number, slug: string): Promise<CustomPage | null> {
    return (
      Array.from(this.customPages.values()).find(
        (page) => page.userId === userId && page.slug === slug && page.published
      ) || null
    );
  }

  getUserCustomPages(userId: number): CustomPage[] {
    return Array.from(this.customPages.values())
      .filter((page) => page.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateCustomPage(
    id: string,
    updates: Partial<CustomPage>
  ): Promise<CustomPage | null> {
    const existing = this.customPages.get(id);
    if (!existing) return null;

    const updated: CustomPage = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve id
      userId: existing.userId, // Preserve userId
      updatedAt: new Date(),
    };

    this.customPages.set(id, updated);
    return updated;
  }

  async deleteCustomPage(id: string): Promise<boolean> {
    return this.customPages.delete(id);
  }

  // CSS Generation
  generateCustomCss(config: BrandingConfig): string {
    return `
      :root {
        --primary-color: ${config.primaryColor};
        --secondary-color: ${config.secondaryColor};
        --accent-color: ${config.accentColor};
      }
      
      .branded-logo {
        background-image: url('${config.logo || ''}');
      }
      
      .branded-login {
        background-image: url('${config.loginBackgroundImage || ''}');
      }
      
      ${config.customCss || ''}
    `.trim();
  }

  // Email Template Processing
  processEmailTemplate(
    template: string,
    variables: Record<string, string>
  ): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return processed;
  }
}

export const brandingService = new BrandingService();
