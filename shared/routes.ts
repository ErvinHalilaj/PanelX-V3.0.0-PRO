import { z } from 'zod';
import { 
  insertUserSchema, 
  insertCategorySchema, 
  insertStreamSchema, 
  insertBouquetSchema, 
  insertLineSchema,
  insertServerSchema,
  insertEpgSourceSchema,
  insertSeriesSchema,
  insertEpisodeSchema,
  insertVodInfoSchema,
  insertBlockedIpSchema,
  insertBlockedUserAgentSchema,
  insertDeviceTemplateSchema,
  insertTranscodeProfileSchema,
  insertResellerGroupSchema,
  insertPackageSchema,
  users,
  categories,
  streams,
  bouquets,
  lines,
  activeConnections,
  activityLog,
  creditTransactions,
  servers,
  epgSources,
  series,
  episodes,
  vodInfo,
  blockedIps,
  blockedUserAgents,
  deviceTemplates,
  transcodeProfiles,
  resellerGroups,
  packages
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // === USERS (Admin/Reseller Management) ===
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id',
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    addCredits: {
      method: 'POST' as const,
      path: '/api/users/:id/credits',
      input: z.object({
        amount: z.number(),
        reason: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === CATEGORIES ===
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: insertCategorySchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/categories/:id',
      input: insertCategorySchema.partial(),
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/categories/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === STREAMS ===
  streams: {
    list: {
      method: 'GET' as const,
      path: '/api/streams',
      input: z.object({
        categoryId: z.string().optional(),
        type: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof streams.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/streams/:id',
      responses: {
        200: z.custom<typeof streams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/streams',
      input: insertStreamSchema,
      responses: {
        201: z.custom<typeof streams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/streams/:id',
      input: insertStreamSchema.partial(),
      responses: {
        200: z.custom<typeof streams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/streams/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    checkStatus: {
      method: 'POST' as const,
      path: '/api/streams/:id/check',
      responses: {
        200: z.object({ status: z.string() }),
      },
    },
  },

  // === BOUQUETS ===
  bouquets: {
    list: {
      method: 'GET' as const,
      path: '/api/bouquets',
      responses: {
        200: z.array(z.custom<typeof bouquets.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/bouquets/:id',
      responses: {
        200: z.custom<typeof bouquets.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/bouquets',
      input: insertBouquetSchema,
      responses: {
        201: z.custom<typeof bouquets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/bouquets/:id',
      input: insertBouquetSchema.partial(),
      responses: {
        200: z.custom<typeof bouquets.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/bouquets/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === LINES (SUBSCRIPTIONS) ===
  lines: {
    list: {
      method: 'GET' as const,
      path: '/api/lines',
      responses: {
        200: z.array(z.custom<typeof lines.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/lines/:id',
      responses: {
        200: z.custom<typeof lines.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/lines',
      input: insertLineSchema.extend({
        useCredits: z.boolean().optional(),
        creditCost: z.number().optional(),
      }),
      responses: {
        201: z.custom<typeof lines.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/lines/:id',
      input: insertLineSchema.partial(),
      responses: {
        200: z.custom<typeof lines.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/lines/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    extend: {
      method: 'POST' as const,
      path: '/api/lines/:id/extend',
      input: z.object({
        days: z.number(),
        useCredits: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof lines.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // === CONNECTIONS (Real-time monitoring) ===
  connections: {
    list: {
      method: 'GET' as const,
      path: '/api/connections',
      responses: {
        200: z.array(z.custom<typeof activeConnections.$inferSelect>()),
      },
    },
    kill: {
      method: 'DELETE' as const,
      path: '/api/connections/:id',
      responses: {
        204: z.void(),
      },
    },
  },

  // === ACTIVITY LOG ===
  activity: {
    list: {
      method: 'GET' as const,
      path: '/api/activity',
      input: z.object({
        lineId: z.string().optional(),
        limit: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof activityLog.$inferSelect>()),
      },
    },
  },

  // === CREDIT TRANSACTIONS ===
  credits: {
    list: {
      method: 'GET' as const,
      path: '/api/credits',
      input: z.object({
        userId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof creditTransactions.$inferSelect>()),
      },
    },
  },
  
  // === DASHBOARD STATS ===
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalStreams: z.number(),
          totalLines: z.number(),
          activeConnections: z.number(),
          onlineStreams: z.number(),
          totalUsers: z.number(),
          totalCredits: z.number(),
          expiredLines: z.number(),
          trialLines: z.number(),
        }),
      },
    },
  },

  // === SERVERS (Multi-server load balancing) ===
  servers: {
    list: {
      method: 'GET' as const,
      path: '/api/servers',
      responses: {
        200: z.array(z.custom<typeof servers.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/servers/:id',
      responses: {
        200: z.custom<typeof servers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/servers',
      input: insertServerSchema,
      responses: {
        201: z.custom<typeof servers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/servers/:id',
      input: insertServerSchema.partial(),
      responses: {
        200: z.custom<typeof servers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/servers/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === EPG SOURCES ===
  epgSources: {
    list: {
      method: 'GET' as const,
      path: '/api/epg-sources',
      responses: {
        200: z.array(z.custom<typeof epgSources.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/epg-sources/:id',
      responses: {
        200: z.custom<typeof epgSources.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/epg-sources',
      input: insertEpgSourceSchema,
      responses: {
        201: z.custom<typeof epgSources.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/epg-sources/:id',
      input: insertEpgSourceSchema.partial(),
      responses: {
        200: z.custom<typeof epgSources.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/epg-sources/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    refresh: {
      method: 'POST' as const,
      path: '/api/epg-sources/:id/refresh',
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        404: errorSchemas.notFound,
      },
    },
  },

  // === SERIES ===
  series: {
    list: {
      method: 'GET' as const,
      path: '/api/series',
      input: z.object({
        categoryId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof series.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/series/:id',
      responses: {
        200: z.custom<typeof series.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/series',
      input: insertSeriesSchema,
      responses: {
        201: z.custom<typeof series.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/series/:id',
      input: insertSeriesSchema.partial(),
      responses: {
        200: z.custom<typeof series.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/series/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === EPISODES ===
  episodes: {
    list: {
      method: 'GET' as const,
      path: '/api/series/:seriesId/episodes',
      input: z.object({
        seasonNum: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof episodes.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/episodes/:id',
      responses: {
        200: z.custom<typeof episodes.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/series/:seriesId/episodes',
      input: insertEpisodeSchema,
      responses: {
        201: z.custom<typeof episodes.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/episodes/:id',
      input: insertEpisodeSchema.partial(),
      responses: {
        200: z.custom<typeof episodes.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/episodes/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === VOD INFO (Metadata) ===
  vodInfo: {
    get: {
      method: 'GET' as const,
      path: '/api/streams/:streamId/info',
      responses: {
        200: z.custom<typeof vodInfo.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    createOrUpdate: {
      method: 'PUT' as const,
      path: '/api/streams/:streamId/info',
      input: insertVodInfoSchema.omit({ streamId: true }),
      responses: {
        200: z.custom<typeof vodInfo.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // === BLOCKED IPS ===
  blockedIps: {
    list: {
      method: 'GET' as const,
      path: '/api/blocked-ips',
      responses: {
        200: z.array(z.custom<typeof blockedIps.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/blocked-ips',
      input: insertBlockedIpSchema,
      responses: {
        201: z.custom<typeof blockedIps.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/blocked-ips/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === BLOCKED USER AGENTS ===
  blockedUserAgents: {
    list: {
      method: 'GET' as const,
      path: '/api/blocked-user-agents',
      responses: {
        200: z.array(z.custom<typeof blockedUserAgents.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/blocked-user-agents',
      input: insertBlockedUserAgentSchema,
      responses: {
        201: z.custom<typeof blockedUserAgents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/blocked-user-agents/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === DEVICE TEMPLATES (Playlist generation) ===
  deviceTemplates: {
    list: {
      method: 'GET' as const,
      path: '/api/device-templates',
      responses: {
        200: z.array(z.custom<typeof deviceTemplates.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/device-templates/:id',
      responses: {
        200: z.custom<typeof deviceTemplates.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/device-templates',
      input: insertDeviceTemplateSchema,
      responses: {
        201: z.custom<typeof deviceTemplates.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/device-templates/:id',
      input: insertDeviceTemplateSchema.partial(),
      responses: {
        200: z.custom<typeof deviceTemplates.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/device-templates/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === TRANSCODE PROFILES (FFmpeg) ===
  transcodeProfiles: {
    list: {
      method: 'GET' as const,
      path: '/api/transcode-profiles',
      responses: {
        200: z.array(z.custom<typeof transcodeProfiles.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/transcode-profiles/:id',
      responses: {
        200: z.custom<typeof transcodeProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/transcode-profiles',
      input: insertTranscodeProfileSchema,
      responses: {
        201: z.custom<typeof transcodeProfiles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/transcode-profiles/:id',
      input: insertTranscodeProfileSchema.partial(),
      responses: {
        200: z.custom<typeof transcodeProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/transcode-profiles/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === RESELLER GROUPS ===
  resellerGroups: {
    list: {
      method: 'GET' as const,
      path: '/api/reseller-groups',
      responses: {
        200: z.array(z.custom<typeof resellerGroups.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reseller-groups/:id',
      responses: {
        200: z.custom<typeof resellerGroups.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reseller-groups',
      input: insertResellerGroupSchema,
      responses: {
        201: z.custom<typeof resellerGroups.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/reseller-groups/:id',
      input: insertResellerGroupSchema.partial(),
      responses: {
        200: z.custom<typeof resellerGroups.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/reseller-groups/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === PACKAGES ===
  packages: {
    list: {
      method: 'GET' as const,
      path: '/api/packages',
      responses: {
        200: z.array(z.custom<typeof packages.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/packages/:id',
      responses: {
        200: z.custom<typeof packages.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/packages',
      input: insertPackageSchema,
      responses: {
        201: z.custom<typeof packages.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/packages/:id',
      input: insertPackageSchema.partial(),
      responses: {
        200: z.custom<typeof packages.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/packages/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === BULK OPERATIONS ===
  bulk: {
    deleteStreams: {
      method: 'POST' as const,
      path: '/api/bulk/streams/delete',
      input: z.object({ ids: z.array(z.number()) }),
      responses: {
        200: z.object({ deleted: z.number() }),
        400: errorSchemas.validation,
      },
    },
    deleteLines: {
      method: 'POST' as const,
      path: '/api/bulk/lines/delete',
      input: z.object({ ids: z.array(z.number()) }),
      responses: {
        200: z.object({ deleted: z.number() }),
        400: errorSchemas.validation,
      },
    },
    importM3U: {
      method: 'POST' as const,
      path: '/api/bulk/import/m3u',
      input: z.object({ 
        content: z.string(),
        categoryId: z.number().optional(),
        streamType: z.enum(['live', 'movie']).default('live'),
      }),
      responses: {
        200: z.object({ imported: z.number(), streams: z.array(z.custom<typeof streams.$inferSelect>()) }),
        400: errorSchemas.validation,
      },
    },
    importXtream: {
      method: 'POST' as const,
      path: '/api/streams/import-xtream',
      input: z.object({
        url: z.string().url(),
        username: z.string().min(1),
        password: z.string().min(1),
        categoryId: z.number().optional(),
        streamType: z.enum(['live', 'movie']).default('live'),
      }),
      responses: {
        200: z.object({ imported: z.number(), streams: z.array(z.custom<typeof streams.$inferSelect>()), message: z.string().optional() }),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
