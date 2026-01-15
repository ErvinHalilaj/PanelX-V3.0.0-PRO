import { z } from 'zod';
import { 
  insertUserSchema, 
  insertCategorySchema, 
  insertStreamSchema, 
  insertBouquetSchema, 
  insertLineSchema,
  users,
  categories,
  streams,
  bouquets,
  lines,
  activeConnections,
  activityLog,
  creditTransactions
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
