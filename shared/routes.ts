import { z } from 'zod';
import { 
  insertWorkspaceSchema, 
  insertGuideSchema, 
  insertStepSchema, 
  insertFolderSchema,
  workspaces,
  guides,
  steps,
  folders
} from './schema';
import { users } from './models/auth';

// ============================================
// STEP API INPUT SCHEMAS
// These schemas omit flowId since it comes from the URL parameter
// ============================================
export const createStepInputSchema = insertStepSchema.omit({ flowId: true });
export const updateStepInputSchema = insertStepSchema.partial().omit({ flowId: true });

export type CreateStepInput = z.infer<typeof createStepInputSchema>;
export type UpdateStepInput = z.infer<typeof updateStepInputSchema>;

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
  // === WORKSPACES ===
  workspaces: {
    list: {
      method: 'GET' as const,
      path: '/api/workspaces',
      responses: {
        200: z.array(z.custom<typeof workspaces.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/workspaces/:id',
      responses: {
        200: z.custom<typeof workspaces.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/workspaces',
      input: insertWorkspaceSchema,
      responses: {
        201: z.custom<typeof workspaces.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/workspaces/:id',
      input: insertWorkspaceSchema.partial(),
      responses: {
        200: z.custom<typeof workspaces.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },

  // === GUIDES ===
  guides: {
    list: {
      method: 'GET' as const,
      path: '/api/guides',
      input: z.object({
        workspaceId: z.coerce.number().optional(),
        folderId: z.coerce.number().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.object({
          data: z.array(z.custom<typeof guides.$inferSelect>()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          hasMore: z.boolean(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/guides/:id',
      responses: {
        200: z.custom<typeof guides.$inferSelect & { steps: typeof steps.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/guides',
      input: insertGuideSchema,
      responses: {
        201: z.custom<typeof guides.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/guides/:id',
      input: insertGuideSchema.partial(),
      responses: {
        200: z.custom<typeof guides.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/guides/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },

  // === STEPS ===
  // Note: flowId is derived from URL parameter :guideId, not from request body
  steps: {
    list: {
      method: 'GET' as const,
      path: '/api/guides/:guideId/steps',
      responses: {
        200: z.array(z.custom<typeof steps.$inferSelect>()),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/guides/:guideId/steps',
      input: createStepInputSchema,
      responses: {
        201: z.custom<typeof steps.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/steps/:id',
      input: updateStepInputSchema,
      responses: {
        200: z.custom<typeof steps.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/steps/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    reorder: {
      method: 'POST' as const,
      path: '/api/guides/:guideId/steps/reorder',
      input: z.object({ stepIds: z.array(z.number()) }),
      responses: {
        200: z.void(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },

  // === FOLDERS ===
  folders: {
    list: {
      method: 'GET' as const,
      path: '/api/folders',
      input: z.object({
        workspaceId: z.coerce.number(),
        parentId: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(z.custom<typeof folders.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/folders',
      input: insertFolderSchema,
      responses: {
        201: z.custom<typeof folders.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  
  // === AI ===
  ai: {
    generateDescription: {
      method: 'POST' as const,
      path: '/api/ai/generate-description',
      input: z.object({
        stepTitle: z.string(),
        actionType: z.string(),
        context: z.string().optional(),
      }),
      responses: {
        200: z.object({ description: z.string() }),
        401: errorSchemas.unauthorized,
        500: errorSchemas.internal,
      },
    },
  },

  // === EXTENSION ===
  extension: {
    syncCapture: {
      method: 'POST' as const,
      path: '/api/extension/sync',
      input: z.object({
        workspaceId: z.number(),
        title: z.string().optional(),
        steps: z.array(z.object({
          type: z.string(),
          description: z.string(),
          selector: z.string().optional(),
          url: z.string(),
          pageTitle: z.string(),
          screenshot: z.string().optional(),
          timestamp: z.number(),
          element: z.object({
            tagName: z.string(),
            id: z.string().nullable(),
            text: z.string().optional(),
            type: z.string().nullable(),
            ariaLabel: z.string().nullable(),
          }).optional(),
          elementBounds: z.object({
            left: z.number(),
            top: z.number(),
            width: z.number(),
            height: z.number(),
            scrollX: z.number(),
            scrollY: z.number(),
            viewportWidth: z.number(),
            viewportHeight: z.number(),
          }).optional().nullable(),
          borderColor: z.string().optional().nullable(),
          isElementCapture: z.boolean().optional(),
        })),
      }),
      responses: {
        201: z.object({
          guideId: z.number(),
          stepsCreated: z.number(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    getUser: {
      method: 'GET' as const,
      path: '/api/extension/user',
      responses: {
        200: z.object({
          id: z.string(),
          username: z.string(),
          profileImage: z.string().nullable(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    listWorkspaces: {
      method: 'GET' as const,
      path: '/api/extension/workspaces',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          name: z.string(),
          slug: z.string(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

// ============================================
// HELPER FUNCTION
// ============================================
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
