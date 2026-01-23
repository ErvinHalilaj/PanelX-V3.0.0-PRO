import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface BrandingConfig {
  id: string;
  userId: number;
  companyName: string;
  logo?: string;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Get branding config
 */
export function useBrandingConfig(userId: number) {
  return useQuery({
    queryKey: ['brandingConfig', userId],
    queryFn: async () => {
      const { data } = await axios.get<BrandingConfig>(`/api/branding/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Create branding config
 */
export function useCreateBrandingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<BrandingConfig> & { userId: number }) => {
      const { data } = await axios.post<BrandingConfig>('/api/branding', config);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brandingConfig', variables.userId] });
    },
  });
}

/**
 * Update branding config
 */
export function useUpdateBrandingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: number; updates: Partial<BrandingConfig> }) => {
      const { data } = await axios.put<BrandingConfig>(`/api/branding/${params.userId}`, params.updates);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brandingConfig', variables.userId] });
    },
  });
}

/**
 * Delete branding config
 */
export function useDeleteBrandingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await axios.delete(`/api/branding/${userId}`);
      return data;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['brandingConfig', userId] });
    },
  });
}

/**
 * Get all themes
 */
export function useThemes() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const { data } = await axios.get<{ themes: Theme[] }>('/api/branding/themes/all');
      return data.themes;
    },
  });
}

/**
 * Get theme by ID
 */
export function useTheme(id: string) {
  return useQuery({
    queryKey: ['theme', id],
    queryFn: async () => {
      const { data } = await axios.get<Theme>(`/api/branding/themes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create custom theme
 */
export function useCreateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (theme: Omit<Theme, 'id'>) => {
      const { data } = await axios.post<Theme>('/api/branding/themes', theme);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

/**
 * Update theme
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Theme> }) => {
      const { data } = await axios.put<Theme>(`/api/branding/themes/${params.id}`, params.updates);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['theme', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

/**
 * Delete theme
 */
export function useDeleteTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete(`/api/branding/themes/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

/**
 * Get custom pages for user
 */
export function useCustomPages(userId: number) {
  return useQuery({
    queryKey: ['customPages', userId],
    queryFn: async () => {
      const { data } = await axios.get<{ pages: CustomPage[] }>(`/api/branding/pages/${userId}`);
      return data.pages;
    },
    enabled: !!userId,
  });
}

/**
 * Create custom page
 */
export function useCreateCustomPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (page: Omit<CustomPage, 'id' | 'createdAt' | 'updatedAt'> & { userId: number }) => {
      const { data } = await axios.post<CustomPage>('/api/branding/pages', page);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customPages', variables.userId] });
    },
  });
}

/**
 * Update custom page
 */
export function useUpdateCustomPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<CustomPage> }) => {
      const { data } = await axios.put<CustomPage>(`/api/branding/pages/${params.id}`, params.updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customPages', data.userId] });
    },
  });
}

/**
 * Delete custom page
 */
export function useDeleteCustomPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; userId: number }) => {
      const { data } = await axios.delete(`/api/branding/pages/${params.id}`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customPages', variables.userId] });
    },
  });
}
