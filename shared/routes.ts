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
  lines
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
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
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
    create: {
      method: 'POST' as const,
      path: '/api/bouquets',
      input: insertBouquetSchema,
      responses: {
        201: z.custom<typeof bouquets.$inferSelect>(),
        400: errorSchemas.validation,
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
    create: {
      method: 'POST' as const,
      path: '/api/lines',
      input: insertLineSchema,
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
