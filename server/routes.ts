import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { anthropic } from "./lib/anthropic";
import { analyzeStepWithVision } from "./services/visionService";
import { runGuideIntelligence } from "./services/guideIntelligenceService";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { insertBlogPostSchema, users, steps, guideVersions, SUPPORTED_LANGUAGES } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { emailService } from "./services/emailService";
import { billingService } from "./services/billingService";
import { invitationService } from "./services/invitationService";
import { integrationsService } from "./services/integrationsService";
import { validateIntegrationCredentials, triggerIntegrationSync, getProvider } from "./services/integrationProviders";
import { db } from "./db";
import sanitizeHtml from "sanitize-html"; 

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === SECURITY MIDDLEWARE ===
  // Helmet for secure headers (XSS protection, etc.)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }));

  // Rate limiting for auth endpoints (strict)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: { message: "Too many attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // General API rate limiting (moderate)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: { message: "Too many requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for static assets and health checks
      return req.path.startsWith('/assets') || req.path === '/api/health';
    },
  });

  // AI/expensive operation rate limiting (strict)
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
    message: { message: "AI rate limit reached, please wait before trying again" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to sensitive auth endpoints
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  // Apply general API rate limiting
  app.use('/api', apiLimiter);

  // Apply AI rate limiting to expensive operations
  app.use('/api/ai', aiLimiter);
  app.use('/api/chat', aiLimiter);
  app.use('/api/image/generate', aiLimiter);

  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Setup other integrations
  registerObjectStorageRoutes(app);
  registerChatRoutes(app);
  registerImageRoutes(app);

  // === EXTENSION API ENDPOINTS ===
  
  // Upload screenshot from extension (multipart form data)
  app.post('/api/upload/screenshot', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectStorage = new ObjectStorageService();
      
      // Get presigned URL for upload
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      
      // Return the upload URL and path for client to use
      res.json({
        uploadURL,
        url: objectPath,
        objectPath
      });
    } catch (error) {
      console.error("Screenshot upload error:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Create flow with steps from extension
  const flowStepSchema = z.object({
    order: z.coerce.number().int().min(1).optional(),
    type: z.enum(['click', 'input', 'scroll', 'navigate', 'hover', 'select']).default('click'),
    description: z.string().nullable().optional().transform(v => v?.trim() || null),
    imageUrl: z.string().nullable().optional(),
    selector: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    metadata: z.any().optional()
  });
  
  const createFlowSchema = z.object({
    title: z.string().min(1).default('Untitled Flow'),
    workspaceId: z.coerce.number().optional(),
    steps: z.array(flowStepSchema).min(1, "At least one step is required")
  });
  
  app.post('/api/flows', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    
    try {
      // Validate input with Zod
      const validatedInput = createFlowSchema.parse(req.body);
      const { title, steps: flowSteps, workspaceId } = validatedInput;
      
      // Get or create default workspace if not provided
      let targetWorkspaceId = workspaceId;
      if (!targetWorkspaceId) {
        const workspaces = await storage.getWorkspacesForUser(userId);
        if (workspaces.length > 0) {
          targetWorkspaceId = workspaces[0].id;
        } else {
          // Create default workspace
          const firstName = user.claims.first_name || "My";
          const slug = `personal-${userId.slice(0, 8)}-${Date.now()}`;
          const newWorkspace = await storage.createWorkspace({
            name: `${firstName}'s Workspace`,
            slug,
            ownerId: userId,
          });
          targetWorkspaceId = newWorkspace.id;
        }
      }
      
      // Create the flow/guide
      const guide = await storage.createGuide({
        title: title || 'Untitled Flow',
        workspaceId: targetWorkspaceId,
        createdById: userId,
        status: 'draft'
      });
      
      // Create steps (required minimum 1)
      for (let i = 0; i < flowSteps.length; i++) {
        const stepData = flowSteps[i];
        // Use provided order or fall back to 1-based index
        const stepOrder = stepData.order !== undefined && stepData.order >= 1 ? stepData.order : (i + 1);
        const stepTitle = stepData.description || `Step ${stepOrder}`;
        
        // Map extension step types to valid schema types
        const typeMap: Record<string, "click" | "input" | "navigation" | "wait" | "scroll" | "custom"> = {
          'click': 'click',
          'input': 'input',
          'select': 'input',
          'scroll': 'scroll',
          'navigate': 'navigation',
          'navigation': 'navigation',
          'hover': 'custom',
          'wait': 'wait',
          'custom': 'custom'
        };
        const mappedType = typeMap[stepData.type] || 'click';
        
        await storage.createStep({
          flowId: guide.id,
          order: stepOrder,
          title: stepTitle,
          description: stepData.description || null,
          imageUrl: stepData.imageUrl || null,
          actionType: mappedType,
          selector: stepData.selector || null,
          url: stepData.url || null,
          metadata: stepData.metadata || null
        });
      }
      
      res.status(201).json(guide);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: error.errors[0].message,
          field: error.errors[0].path.join('.'),
        });
      }
      console.error("Create flow error:", error);
      res.status(500).json({ message: "Failed to create flow" });
    }
  });

  // === WORKSPACES ===
  app.get(api.workspaces.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaces = await storage.getWorkspacesForUser(userId);
    res.json(workspaces);
  });

  app.post(api.workspaces.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const input = api.workspaces.create.input.parse({ ...req.body, ownerId: userId });
      const workspace = await storage.createWorkspace(input);
      res.status(201).json(workspace);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.workspaces.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaceId = Number(req.params.id);
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    if (!await canAccessWorkspace(userId, workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(workspace);
  });

  app.post('/api/workspaces/ensure-default', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const firstName = user.claims.first_name || "My";

    try {
      const existingWorkspaces = await storage.getWorkspacesForUser(userId);
      if (existingWorkspaces.length > 0) {
        return res.json(existingWorkspaces[0]);
      }

      const slug = `personal-${userId.slice(0, 8)}-${Date.now()}`;
      const workspace = await storage.createWorkspace({
        name: `${firstName}'s Workspace`,
        slug,
        ownerId: userId,
      });
      res.status(201).json(workspace);
    } catch (err) {
      console.error("Failed to create default workspace:", err);
      res.status(500).json({ message: "Failed to create workspace" });
    }
  });

  // === EXTENSION CAPTURE API ===
  // Single endpoint for the popup to call before starting a capture session.
  // It ensures the user has a workspace, creates a fresh guide, and returns the guideId.
  // Works with both cookie sessions and Bearer token auth (so the popup can call it directly).
  app.post('/api/extension/start-capture', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const firstName = user.claims.first_name || "My";

    try {
      // Ensure workspace exists
      let workspace;
      const existingWorkspaces = await storage.getWorkspacesForUser(userId);
      if (existingWorkspaces.length > 0) {
        workspace = existingWorkspaces[0];
      } else {
        const slug = `personal-${userId.slice(0, 8)}-${Date.now()}`;
        workspace = await storage.createWorkspace({
          name: `${firstName}'s Workspace`,
          slug,
          ownerId: userId,
        });
      }

      // Create a fresh guide
      const guide = await storage.createGuide({
        title: 'Untitled Flow',
        description: '',
        workspaceId: workspace.id,
        createdById: userId,
      });

      res.json({ guideId: guide.id, workspaceId: workspace.id });
    } catch (err) {
      console.error('[extension/start-capture] Error:', err);
      res.status(500).json({ message: "Failed to start capture" });
    }
  });

  // === GUIDES ===
  app.get(api.guides.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    if (!workspaceId) {
      return res.json({ data: [], total: 0, page, limit, hasMore: false });
    }

    if (!await canAccessWorkspace(userId, workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const guides = await storage.getGuidesByWorkspace(workspaceId);
    const paginatedGuides = guides.slice(offset, offset + limit);
    
    // Fetch first step's imageUrl for each guide to use as fallback thumbnail
    const guidesWithThumbnails = await Promise.all(
      paginatedGuides.map(async (guide) => {
        if (guide.coverImageUrl) {
          return guide; // Already has a cover image
        }
        const steps = await storage.getStepsByGuide(guide.id);
        const firstStep = steps[0];
        return {
          ...guide,
          coverImageUrl: firstStep?.imageUrl || null
        };
      })
    );
    
    res.json({ 
      data: guidesWithThumbnails, 
      total: guides.length,
      page,
      limit,
      hasMore: offset + limit < guides.length
    });
  });

  app.post(api.guides.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const input = api.guides.create.input.parse({ ...req.body, createdById: userId });
      if (!await canAccessWorkspace(userId, input.workspaceId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const guide = await storage.createGuide(input);
      res.status(201).json(guide);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.guides.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.id);

    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });

    if (!await canAccessWorkspace(userId, guide.workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const steps = await storage.getStepsByGuide(guide.id);
    res.json({ ...guide, steps });
  });

  app.put(api.guides.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.id);

    if (!await canManageGuideShare(userId, guideId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const input = api.guides.update.input.parse(req.body);
      const guide = await storage.updateGuide(guideId, input);
      res.json(guide);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.guides.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.id);

    if (!await canManageGuideShare(userId, guideId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteGuide(guideId);
    res.status(204).send();
  });

  // === STEPS ===
  app.get(api.steps.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    if (!await canAccessGuide(userId, guideId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const steps = await storage.getStepsByGuide(guideId);
    res.json(steps);
  });

  app.post(api.steps.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);

    if (!await canManageGuideShare(userId, guideId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      // Validate request body (flowId is omitted from input schema)
      const input = api.steps.create.input.parse(req.body);
      // Merge flowId from URL parameter
      const stepData = { ...input, flowId: guideId };
      const step = await storage.createStep(stepData);
      res.status(201).json(step);

      // Fire vision analysis in background — does not block response
      if (step.imageUrl && process.env.ANTHROPIC_API_KEY) {
        const appBaseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
        const meta = (req.body.metadata || {}) as Record<string, any>;
        setImmediate(async () => {
          // Fetch previous step titles for workflow chain context
          let previousStepTitles: string[] = [];
          try {
            const prevSteps = await storage.getStepsByGuide(guideId);
            previousStepTitles = prevSteps
              .filter(s => s.id !== step.id && s.order < step.order)
              .sort((a, b) => a.order - b.order)
              .slice(-5) // last 5 steps for context
              .map(s => s.title || 'Untitled step');
          } catch (_) {}

          analyzeStepWithVision(step.id, step.imageUrl!, {
            actionType: step.actionType,
            selector: step.selector,
            url: step.url,
            elementText: meta.innerText || meta.textContent || null,
            elementTag: meta.tagName || null,
            elementRole: meta.role || null,
            ariaLabel: meta.ariaLabel || null,
            associatedLabel: meta.associatedLabel || null,
            placeholder: meta.placeholder || null,
            inputValue: meta.value || null,
            pageTitle: meta.pageTitle || req.body.tabTitle || null,
            nearestHeading: meta.nearestHeading || null,
            pageSection: meta.pageSection || null,
            formContext: meta.formContext || null,
            isDragDrop: meta.isDragDrop || false,
            isFileUpload: meta.isFileUpload || false,
            isPaste: meta.isPaste || false,
            isRightClick: meta.isRightClick || false,
            isFormSubmit: meta.isFormSubmit || false,
            domChange: meta.domChange || null,
            fileNames: meta.fileNames || null,
            pastedTextPreview: meta.pastedTextPreview || null,
          }, appBaseUrl, previousStepTitles);
        });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.steps.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = api.steps.update.input.parse(req.body);
      const step = await storage.updateStep(Number(req.params.id), input);
      res.json(step);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.steps.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteStep(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.steps.reorder.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const { stepIds } = req.body;
    await storage.reorderSteps(stepIds);
    res.status(200).send();
  });

  // === FOLDERS ===
  app.get(api.folders.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = Number(req.query.workspaceId);
    const folders = await storage.getFoldersByWorkspace(workspaceId);
    res.json(folders);
  });

  app.post(api.folders.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.folders.create.input.parse(req.body);
      const folder = await storage.createFolder(input);
      res.status(201).json(folder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === COLLECTIONS ===
  
  // Helper to check workspace access (any role — owner or any member)
  async function canAccessWorkspace(userId: string, workspaceId: number): Promise<boolean> {
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return false;
    if (workspace.ownerId === userId) return true;
    const members = await storage.getWorkspaceMembers(workspaceId);
    return members.some(m => m.userId === userId);
  }

  // Helper to check read access to a guide (any workspace member)
  async function canAccessGuide(userId: string, guideId: number): Promise<boolean> {
    const guide = await storage.getGuide(guideId);
    if (!guide) return false;
    return canAccessWorkspace(userId, guide.workspaceId);
  }

  app.get('/api/workspaces/:workspaceId/collections', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaceId = Number(req.params.workspaceId);
    
    if (!await canAccessWorkspace(userId, workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const collectionsList = await storage.getCollectionsByWorkspace(workspaceId);
    
    const collectionsWithCounts = await Promise.all(
      collectionsList.map(async (collection) => ({
        ...collection,
        flowCount: await storage.getCollectionFlowCount(collection.id)
      }))
    );
    
    res.json(collectionsWithCounts);
  });

  app.post('/api/workspaces/:workspaceId/collections', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaceId = Number(req.params.workspaceId);
    
    if (!await canAccessWorkspace(userId, workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    try {
      const { name, description, color, icon, parentId } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Collection name is required" });
      }
      
      const collection = await storage.createCollection({
        name: name.trim(),
        description: description || null,
        color: color || null,
        icon: icon || null,
        parentId: parentId || null,
        workspaceId
      });
      
      res.status(201).json(collection);
    } catch (err) {
      console.error('Error creating collection:', err);
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.get('/api/collections/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    
    const collection = await storage.getCollection(Number(req.params.id));
    if (!collection) return res.status(404).json({ message: "Collection not found" });
    
    if (!await canAccessWorkspace(userId, collection.workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const flowCount = await storage.getCollectionFlowCount(collection.id);
    res.json({ ...collection, flowCount });
  });

  app.put('/api/collections/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    
    try {
      const collection = await storage.getCollection(Number(req.params.id));
      if (!collection) return res.status(404).json({ message: "Collection not found" });
      
      if (!await canAccessWorkspace(userId, collection.workspaceId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { name, description, color, icon, parentId } = req.body;
      const updated = await storage.updateCollection(Number(req.params.id), {
        name,
        description,
        color,
        icon,
        parentId
      });
      res.json(updated);
    } catch (err) {
      console.error('Error updating collection:', err);
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  app.delete('/api/collections/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    
    const collectionId = Number(req.params.id);
    const collection = await storage.getCollection(collectionId);
    if (!collection) return res.status(404).json({ message: "Collection not found" });
    
    if (!await canAccessWorkspace(userId, collection.workspaceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const flowCount = await storage.getCollectionFlowCount(collectionId);
    
    if (flowCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete collection that contains flows. Move or delete the flows first." 
      });
    }
    
    await storage.deleteCollection(collectionId);
    res.status(204).send();
  });

  app.post('/api/flows/:id/move', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    
    try {
      const flowId = Number(req.params.id);
      const { collectionId } = req.body;
      
      const flow = await storage.getGuide(flowId);
      if (!flow) return res.status(404).json({ message: "Flow not found" });
      
      if (!await canAccessWorkspace(userId, flow.workspaceId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (collectionId) {
        const collection = await storage.getCollection(collectionId);
        if (!collection || collection.workspaceId !== flow.workspaceId) {
          return res.status(400).json({ message: "Invalid collection" });
        }
      }
      
      const guide = await storage.updateGuide(flowId, {
        collectionId: collectionId || null
      });
      
      res.json(guide);
    } catch (err) {
      console.error('Error moving flow:', err);
      res.status(500).json({ message: "Failed to move flow" });
    }
  });

  // === GUIDE SHARING (Password-Protected) ===
  
  // Helper to check if user can manage guide sharing
  async function canManageGuideShare(userId: string, guideId: number): Promise<boolean> {
    const guide = await storage.getGuide(guideId);
    if (!guide) return false;
    
    const workspace = await storage.getWorkspace(guide.workspaceId);
    if (!workspace) return false;
    
    // Owner can always manage
    if (workspace.ownerId === userId) return true;
    
    // Check if user is a member with edit permissions
    const members = await storage.getWorkspaceMembers(guide.workspaceId);
    const member = members.find(m => m.userId === userId);
    if (member && ['owner', 'admin', 'editor'].includes(member.role)) return true;
    
    return false;
  }
  
  // Get share settings for a guide (owner/editor only)
  app.get('/api/guides/:guideId/share', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });
    
    // Authorization check
    const canManage = await canManageGuideShare(userId, guideId);
    if (!canManage) return res.status(403).json({ message: "Access denied" });
    
    const share = await storage.getGuideShareByGuideId(guideId);
    if (!share) {
      return res.json({ enabled: false, hasPassword: false, shareUrl: null });
    }
    
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
    res.json({
      id: share.id,
      enabled: share.enabled,
      hasPassword: !!share.passwordHash,
      shareUrl: `${baseUrl}/share/${share.shareToken}`,
      shareToken: share.shareToken,
      accessCount: share.accessCount,
      lastAccessedAt: share.lastAccessedAt,
    });
  });

  // Create or update share settings for a guide
  app.post('/api/guides/:guideId/share', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });
    
    // Authorization check
    const canManage = await canManageGuideShare(userId, guideId);
    if (!canManage) return res.status(403).json({ message: "Access denied" });
    
    const { password, enabled = true } = req.body;
    
    const existingShare = await storage.getGuideShareByGuideId(guideId);
    
    let passwordHash = existingShare?.passwordHash || null;
    if (password !== undefined) {
      if (password === null || password === '') {
        passwordHash = null;
      } else {
        passwordHash = await bcrypt.hash(password, 10);
      }
    }
    
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
    
    if (existingShare) {
      const updated = await storage.updateGuideShare(existingShare.id, {
        passwordHash,
        enabled,
      });
      return res.json({
        id: updated.id,
        enabled: updated.enabled,
        hasPassword: !!updated.passwordHash,
        shareUrl: `${baseUrl}/share/${updated.shareToken}`,
        shareToken: updated.shareToken,
      });
    }
    
    const shareToken = crypto.randomBytes(16).toString('hex');
    const created = await storage.createGuideShare({
      flowId: guideId,
      shareToken,
      passwordHash,
      enabled,
    });
    
    res.status(201).json({
      id: created.id,
      enabled: created.enabled,
      hasPassword: !!created.passwordHash,
      shareUrl: `${baseUrl}/share/${shareToken}`,
      shareToken: shareToken,
    });
  });

  // Delete share settings (disable sharing)
  app.delete('/api/guides/:guideId/share', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });
    
    // Authorization check
    const canManage = await canManageGuideShare(userId, guideId);
    if (!canManage) return res.status(403).json({ message: "Access denied" });
    
    const share = await storage.getGuideShareByGuideId(guideId);
    if (share) {
      await storage.deleteGuideShare(share.id);
    }
    
    res.status(204).send();
  });

  // Public: Get shared guide info (no password required)
  app.get('/api/share/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const share = await storage.getGuideShareByToken(token);
      if (!share || !share.enabled) {
        return res.status(404).json({ message: "Guide not found or sharing is disabled" });
      }
      
      const guide = await storage.getGuide(share.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const translations = await storage.getGuideTranslations(share.flowId);
      const completedTranslations = translations.filter(t => t.status === 'completed');
      const availableLanguages = completedTranslations.map(t => ({
        code: t.locale,
        name: SUPPORTED_LANGUAGES.find(l => l.code === t.locale)?.name || t.locale,
      }));
      
      res.json({
        title: guide.title,
        requiresPassword: !!share.passwordHash,
        guideId: guide.id,
        availableLanguages,
      });
    } catch (error) {
      console.error("Share lookup error:", error);
      res.status(500).json({ message: "Failed to load shared guide" });
    }
  });

  // Public: Verify password and get shared guide content
  app.post('/api/share/:token/verify', async (req, res) => {
    try {
      const { token } = req.params;
      const { password, locale } = req.body;
      
      const share = await storage.getGuideShareByToken(token);
      if (!share || !share.enabled) {
        return res.status(404).json({ message: "Guide not found or sharing is disabled" });
      }
      
      if (share.passwordHash) {
        if (!password) {
          return res.status(401).json({ message: "Password required" });
        }
        
        const isValid = await bcrypt.compare(password, share.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "Invalid password" });
        }
      }
      
      await storage.incrementShareAccessCount(share.id);
      
      const guide = await storage.getGuide(share.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const steps = await storage.getStepsByGuide(share.flowId);
      
      let translations = undefined;
      if (locale && locale !== 'en') {
        const guideTranslation = await storage.getGuideTranslation(share.flowId, locale);
        const stepTranslations = await storage.getStepTranslationsByGuide(share.flowId, locale);
        
        if (guideTranslation && guideTranslation.status === 'completed') {
          translations = {
            guide: {
              title: guideTranslation.title,
              description: guideTranslation.description,
            },
            steps: stepTranslations
              .filter(t => t.status === 'completed')
              .map(t => ({
                stepId: t.stepId,
                title: t.title,
                description: t.description,
              })),
          };
        }
      }
      
      res.json({
        guide: {
          id: guide.id,
          title: guide.title,
          description: guide.description,
          coverImageUrl: guide.coverImageUrl,
        },
        steps: steps.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl,
          actionType: s.actionType,
          metadata: s.metadata,
        })),
        translations,
      });
    } catch (error) {
      console.error("Share verification error:", error);
      res.status(500).json({ message: "Failed to verify shared guide" });
    }
  });

  // === GUIDE EXPORT ===
  
  // Export guide as HTML (Word-compatible)
  app.get('/api/guides/:guideId/export/html', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });
    
    const canManage = await canManageGuideShare(userId, guideId);
    if (!canManage) return res.status(403).json({ message: "Access denied" });
    
    const steps = await storage.getStepsByGuide(guideId);
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${guide.title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 16px; }
    .description { color: #666; margin-bottom: 32px; }
    .step { margin-bottom: 40px; page-break-inside: avoid; }
    .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .step-number { background: #4f46e5; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
    .step-title { font-size: 18px; font-weight: 600; margin: 0; }
    .step-description { color: #555; margin-left: 40px; }
    .step-image { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; margin: 12px 0 12px 40px; }
    @media print { .step { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${guide.title}</h1>
  ${guide.description ? `<p class="description">${guide.description}</p>` : ''}
  
  ${sortedSteps.map((step, index) => `
  <div class="step">
    <div class="step-header">
      <div class="step-number">${index + 1}</div>
      <h2 class="step-title">${step.title || `Step ${index + 1}`}</h2>
    </div>
    ${step.description ? `<p class="step-description">${step.description}</p>` : ''}
    ${step.imageUrl ? `<img class="step-image" src="${step.imageUrl}" alt="${step.title || 'Step screenshot'}" />` : ''}
  </div>
  `).join('')}
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${guide.title.replace(/[^a-zA-Z0-9]/g, '_')}.html"`);
    res.send(html);
  });

  const allowIframe = (_req: any, res: any, next: any) => {
    res.removeHeader('X-Frame-Options');
    next();
  };

  // Get embed info for a guide (returns embed code)
  app.get('/api/guides/:guideId/embed', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const guideId = Number(req.params.guideId);
    
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ message: "Guide not found" });
    
    const canManage = await canManageGuideShare(userId, guideId);
    if (!canManage) return res.status(403).json({ message: "Access denied" });
    
    // Check if sharing is enabled and not password-protected
    const share = await storage.getGuideShareByGuideId(guideId);
    if (!share || !share.enabled) {
      return res.status(400).json({ 
        message: "Sharing must be enabled to embed this guide",
        sharingDisabled: true
      });
    }
    
    if (share.passwordHash) {
      return res.status(400).json({ 
        message: "Password-protected guides cannot be embedded",
        passwordProtected: true
      });
    }
    
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
    const embedUrl = `${baseUrl}/embed/${share.shareToken}`;
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allow="fullscreen" style="border-radius: 8px; border: 1px solid #e5e7eb;"></iframe>`;
    
    res.json({
      embedUrl,
      embedCode,
      shareToken: share.shareToken,
    });
  });

  // Public: Get embed content (for iframe)
  app.get('/api/embed/:token', allowIframe, async (req, res) => {
    try {
      const { token } = req.params;
      
      const share = await storage.getGuideShareByToken(token);
      if (!share || !share.enabled) {
        return res.status(404).json({ message: "Guide not found or sharing is disabled" });
      }
      
      // Password-protected guides cannot be embedded
      if (share.passwordHash) {
        return res.status(403).json({ message: "Password-protected guides cannot be embedded. Use the share link instead." });
      }
      
      await storage.incrementShareAccessCount(share.id);
      
      const guide = await storage.getGuide(share.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const steps = await storage.getStepsByGuide(share.flowId);
      
      res.json({
        guide: {
          id: guide.id,
          title: guide.title,
          description: guide.description,
          coverImageUrl: guide.coverImageUrl,
        },
        steps: steps.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl,
          actionType: s.actionType,
          metadata: s.metadata,
        })),
      });
    } catch (error) {
      console.error("Embed lookup error:", error);
      res.status(500).json({ message: "Failed to load embedded guide" });
    }
  });

  // === AI ===
  app.post(api.ai.generateDescription.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { stepTitle, actionType, context, selector, url, previousStep, nextStep } = req.body;

      // Build grounded context from actual captured data
      const groundedContext = [];
      if (url) groundedContext.push(`Page URL: ${url}`);
      if (selector) groundedContext.push(`Element selector: ${selector}`);
      if (previousStep) groundedContext.push(`Previous step: ${previousStep}`);
      if (nextStep) groundedContext.push(`Next step: ${nextStep}`);
      if (context) groundedContext.push(`Additional context: ${context}`);

      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        system: `You are a technical writer for a workflow documentation tool. Your job is to write clear, accurate step descriptions.

CRITICAL RULES - FOLLOW EXACTLY:
1. ONLY describe what is explicitly provided in the input data. Never invent or assume details.
2. If the action is "click", describe clicking the specified element.
3. If the action is "input", describe entering information in the specified field.
4. If the action is "navigation", describe navigating to the specified page.
5. Keep descriptions to 1-2 sentences maximum.
6. Use simple, direct language that anyone can follow.
7. Start with an action verb (Click, Enter, Navigate, Select, etc.)
8. If information is unclear, write a generic but accurate description based on the action type.

DO NOT:
- Make up button names, field names, or page names not in the input
- Assume what the user is trying to accomplish beyond what's stated
- Add extra steps or details not captured
- Use technical jargon when simple words work`,
        messages: [
          {
            role: "user",
            content: `Generate a step description based on this captured action:

Action Type: ${actionType}
Element/Title: ${stepTitle || 'Unknown element'}
${groundedContext.length > 0 ? '\n' + groundedContext.join('\n') : ''}

Write a clear, accurate description for this step.`
          }
        ],
      });

      const description = (completion.content[0].type === 'text' ? completion.content[0].text : null) || getDefaultDescription(actionType, stepTitle);
      res.json({ description });
    } catch (error) {
      console.error("AI Generation error:", error);
      // Fallback to safe default description
      const { actionType, stepTitle } = req.body;
      res.json({ description: getDefaultDescription(actionType, stepTitle) });
    }
  });

  // Helper function for safe fallback descriptions
  function getDefaultDescription(actionType: string, stepTitle: string): string {
    const element = stepTitle || 'the element';
    switch (actionType) {
      case 'click':
        return `Click on ${element}.`;
      case 'input':
        return `Enter the required information in ${element}.`;
      case 'navigation':
        return `Navigate to this page.`;
      case 'scroll':
        return `Scroll to view more content.`;
      case 'wait':
        return `Wait for the page to load.`;
      default:
        return `Complete this action: ${element}.`;
    }
  }

  // Batch-generate AI descriptions for all steps in a guide that lack one.
  // Called automatically by the frontend after capture completes.
  app.post("/api/guides/:guideId/generate-all-descriptions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    const guideId = Number(req.params.guideId);
    if (!guideId) return res.status(400).json({ message: "Invalid guide ID" });

    try {
      const allSteps = await storage.getStepsByGuide(guideId);
      // Only process steps that have no meaningful description yet
      const stepsToProcess = allSteps.filter(
        (s) => !s.description || s.description.trim().length < 20
      );

      if (stepsToProcess.length === 0) {
        return res.json({ updated: 0, message: "All steps already have descriptions" });
      }

      let updated = 0;
      for (const step of stepsToProcess) {
        try {
          const completion = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 100,
            system: "You are a technical writer for workflow documentation. Write a single clear, concise step description (1-2 sentences). Start with an action verb. Only describe what you can infer from the provided data.",
            messages: [
              {
                role: "user",
                content: `Action: ${step.actionType}\nElement: ${step.title || "Unknown"}\nSelector: ${step.selector || "N/A"}\nURL: ${step.url || "N/A"}\n\nWrite a step description.`,
              },
            ],
          });

          const description =
            (completion.content[0].type === 'text' ? completion.content[0].text.trim() : null) ||
            getDefaultDescription(step.actionType, step.title ?? '');

          await storage.updateStep(step.id, { description });
          updated++;
        } catch (stepErr) {
          console.error(`Failed to generate description for step ${step.id}:`, stepErr);
          // Continue with remaining steps even if one fails
        }
      }

      res.json({ updated, total: stepsToProcess.length });
    } catch (error) {
      console.error("Batch description generation error:", error);
      res.status(500).json({ message: "Failed to generate descriptions" });
    }
  });

  // AI Screenshot Analysis - analyze screenshot and generate step description
  app.post("/api/ai/analyze-screenshot", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { imageUrl, imageBase64, context, actionType, selector, pageUrl } = req.body;
      
      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ message: "Either imageUrl or imageBase64 is required" });
      }

      const imageContent = imageBase64
        ? { type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: imageBase64 } }
        : { type: "image" as const, source: { type: "url" as const, url: imageUrl as string } };

      // Build grounded context
      const groundedInfo = [];
      if (actionType) groundedInfo.push(`Action performed: ${actionType}`);
      if (selector) groundedInfo.push(`Element selector: ${selector}`);
      if (pageUrl) groundedInfo.push(`Page URL: ${pageUrl}`);
      if (context) groundedInfo.push(`Context: ${context}`);

      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `You are a technical writer analyzing screenshots for workflow documentation.

CRITICAL RULES - FOLLOW EXACTLY:
1. ONLY describe what you can actually see in the screenshot. Never invent details.
2. Use the exact text/labels visible in the UI when naming buttons, fields, or links.
3. If you cannot clearly identify an element, use generic terms like "the button" or "the field".
4. Keep the title under 10 words and start with an action verb.
5. Keep the description to 1-2 sentences maximum.
6. Only list highlights for elements you can clearly see.

DO NOT:
- Guess at button names or field labels you cannot read
- Assume the purpose of the workflow beyond what's visible
- Add steps or actions not shown in the screenshot
- Make up product names, company names, or specific values

If the screenshot is unclear or messy, provide a simple, accurate description of what IS visible.

Return ONLY valid JSON with no extra text: { "title": "...", "description": "...", "highlights": ["..."] }`,
        messages: [
          {
            role: "user",
            content: [
              imageContent,
              { type: "text", text: `Analyze this screenshot and describe the action shown.${groundedInfo.length > 0 ? '\n\nKnown information:\n' + groundedInfo.join('\n') : ''}` },
            ]
          }
        ],
      });

      const content = completion.content[0].type === 'text' ? completion.content[0].text : null;
      const analysis = content ? JSON.parse(content) : { title: "Complete this step", description: "Follow the action shown in the screenshot.", highlights: [] };
      
      res.json(analysis);
    } catch (error) {
      console.error("AI Screenshot Analysis error:", error);
      // Return safe fallback instead of error
      res.json({ 
        title: "Complete this step", 
        description: "Follow the action shown in the screenshot.", 
        highlights: [] 
      });
    }
  });

  // AI Improve Guide - enhance all steps in a guide
  app.post("/api/ai/improve-guide/:guideId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }

      // Authorization: Check if user owns the guide's workspace
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const steps = await storage.getStepsByGuide(guideId);
      
      const stepsInfo = steps.map((s, i) => ({
        order: i + 1,
        title: s.title,
        description: s.description,
        actionType: s.actionType
      }));

      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are an expert technical writer. Review this workflow guide and suggest improvements:
1. Make titles more action-oriented and clear
2. Ensure descriptions are concise but complete
3. Check for missing context or unclear steps
4. Suggest a better overall title if needed

Return ONLY valid JSON with no extra text: { "improvedTitle": "...", "steps": [{ "order": 1, "improvedTitle": "...", "improvedDescription": "..." }], "suggestions": ["..."] }`,
        messages: [
          {
            role: "user",
            content: `Guide Title: ${guide.title}\n\nSteps:\n${JSON.stringify(stepsInfo, null, 2)}`
          }
        ],
      });

      const content = completion.content[0].type === 'text' ? completion.content[0].text : null;
      const improvements = content ? JSON.parse(content) : { improvedTitle: guide.title, steps: [], suggestions: [] };
      
      res.json(improvements);
    } catch (error) {
      console.error("AI Improve Guide error:", error);
      res.status(500).json({ message: "Failed to improve guide" });
    }
  });

  // === TRANSLATION ENDPOINTS ===
  
  // Get supported languages
  app.get("/api/translations/languages", async (req, res) => {
    const { getSupportedLanguages } = await import("./services/translationService");
    res.json(getSupportedLanguages());
  });

  // Get AI integrations status
  app.get("/api/integrations/ai-status", async (req, res) => {
    const claudeConfigured = !!process.env.ANTHROPIC_API_KEY;

    res.json({
      claude: {
        configured: claudeConfigured,
        model: "claude-sonnet-4-6",
      },
      translation: {
        enabled: claudeConfigured,
        supportedLanguages: 15,
      },
    });
  });

  // Get translations for a guide
  app.get("/api/guides/:guideId/translations", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const { getGuideTranslations, getStepTranslations } = await import("./services/translationService");
      
      const guideTranslations = await getGuideTranslations(guideId);
      
      const translationsWithSteps = await Promise.all(
        guideTranslations.map(async (gt) => ({
          ...gt,
          stepTranslations: await getStepTranslations(guideId, gt.locale)
        }))
      );
      
      res.json(translationsWithSteps);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  // Translate a guide to target languages
  app.post("/api/guides/:guideId/translate", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const { locales } = req.body;
      
      if (!locales || !Array.isArray(locales) || locales.length === 0) {
        return res.status(400).json({ message: "At least one target locale is required" });
      }
      
      const { translateGuideWithSteps, isValidLocale } = await import("./services/translationService");
      
      const invalidLocales = locales.filter((l: string) => !isValidLocale(l));
      if (invalidLocales.length > 0) {
        return res.status(400).json({ message: `Invalid locales: ${invalidLocales.join(', ')}` });
      }
      
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const result = await translateGuideWithSteps(guideId, locales);
      res.json(result);
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ message: "Failed to translate guide" });
    }
  });

  // Delete all translations for a guide
  app.delete("/api/guides/:guideId/translations", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      if (workspace.ownerId !== userId) {
        return res.status(403).json({ message: "Only workspace owner can delete translations" });
      }
      
      const { deleteGuideTranslations } = await import("./services/translationService");
      await deleteGuideTranslations(guideId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete translations error:", error);
      res.status(500).json({ message: "Failed to delete translations" });
    }
  });

  // === VOICEOVER ENDPOINTS ===

  // Get available voices
  app.get("/api/voiceover/voices", async (req, res) => {
    const { voiceoverService } = await import("./services/voiceoverService");
    res.json(voiceoverService.getAvailableVoices());
  });

  // Get voiceovers for a guide
  app.get("/api/guides/:guideId/voiceovers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const locale = req.query.locale as string || 'en';
      
      const { voiceoverService } = await import("./services/voiceoverService");
      const voiceovers = await voiceoverService.getGuideVoiceovers(guideId, locale);
      res.json(voiceovers);
    } catch (error) {
      console.error("Get voiceovers error:", error);
      res.status(500).json({ message: "Failed to get voiceovers" });
    }
  });

  // Generate voiceover for a step
  app.post("/api/steps/:stepId/voiceover", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const stepId = Number(req.params.stepId);
      const { voice, locale, text } = req.body;
      
      const step = await storage.getStep(stepId);
      if (!step) {
        return res.status(404).json({ message: "Step not found" });
      }
      
      const guide = await storage.getGuide(step.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { voiceoverService } = await import("./services/voiceoverService");
      const voiceoverText = text || step.description || step.title || `Step ${step.order + 1}`;
      const voiceover = await voiceoverService.generateVoiceover(
        stepId,
        step.flowId,
        voiceoverText,
        voice || 'alloy',
        locale || 'en'
      );
      
      res.json(voiceover);
    } catch (error) {
      console.error("Generate voiceover error:", error);
      res.status(500).json({ message: "Failed to generate voiceover" });
    }
  });

  // Generate voiceovers for entire guide
  app.post("/api/guides/:guideId/voiceovers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const { voice, locale } = req.body;
      
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { voiceoverService } = await import("./services/voiceoverService");
      const results = await voiceoverService.generateGuideVoiceovers(guideId, voice || 'alloy', locale || 'en');
      
      res.json(results);
    } catch (error) {
      console.error("Generate guide voiceovers error:", error);
      res.status(500).json({ message: "Failed to generate voiceovers" });
    }
  });

  // === REDACTION ENDPOINTS ===

  // Get redaction regions for a step
  app.get("/api/steps/:stepId/redactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const stepId = Number(req.params.stepId);
      const { redactionService } = await import("./services/redactionService");
      const regions = await redactionService.getRegionsByStep(stepId);
      res.json(regions);
    } catch (error) {
      console.error("Get redactions error:", error);
      res.status(500).json({ message: "Failed to get redaction regions" });
    }
  });

  // Get all redaction regions for a guide
  app.get("/api/guides/:guideId/redactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.guideId);
      const { redactionService } = await import("./services/redactionService");
      const regions = await redactionService.getRegionsByGuide(guideId);
      res.json(regions);
    } catch (error) {
      console.error("Get guide redactions error:", error);
      res.status(500).json({ message: "Failed to get redaction regions" });
    }
  });

  // Auto-detect sensitive data in a step
  app.post("/api/steps/:stepId/detect-sensitive", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const stepId = Number(req.params.stepId);
      
      const step = await storage.getStep(stepId);
      if (!step) {
        return res.status(404).json({ message: "Step not found" });
      }
      
      const guide = await storage.getGuide(step.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { redactionService } = await import("./services/redactionService");
      const regions = await redactionService.autoDetectAndSave(stepId, step.flowId);
      res.json(regions);
    } catch (error) {
      console.error("Detect sensitive data error:", error);
      res.status(500).json({ message: "Failed to detect sensitive data" });
    }
  });

  // Create a manual redaction region
  app.post("/api/steps/:stepId/redactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const stepId = Number(req.params.stepId);
      const { x, y, width, height, type } = req.body;
      
      const step = await storage.getStep(stepId);
      if (!step) {
        return res.status(404).json({ message: "Step not found" });
      }
      
      const guide = await storage.getGuide(step.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const userId = (req.user as any).id;
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const isMember = members.some(m => m.userId === userId);
      if (workspace.ownerId !== userId && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { redactionService } = await import("./services/redactionService");
      const region = await redactionService.createRegion({
        stepId,
        guideId: step.flowId,
        x,
        y,
        width,
        height,
        type: type || 'blur',
        detectedType: 'manual',
      });
      res.json(region);
    } catch (error) {
      console.error("Create redaction error:", error);
      res.status(500).json({ message: "Failed to create redaction region" });
    }
  });

  // Update a redaction region
  app.patch("/api/redactions/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const id = Number(req.params.id);
      const update = req.body;
      
      const { redactionService } = await import("./services/redactionService");
      const updated = await redactionService.updateRegion(id, update);
      res.json(updated);
    } catch (error) {
      console.error("Update redaction error:", error);
      res.status(500).json({ message: "Failed to update redaction region" });
    }
  });

  // Delete a redaction region
  app.delete("/api/redactions/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const id = Number(req.params.id);
      
      const { redactionService } = await import("./services/redactionService");
      await redactionService.deleteRegion(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete redaction error:", error);
      res.status(500).json({ message: "Failed to delete redaction region" });
    }
  });

  // Toggle a redaction region enabled/disabled
  app.post("/api/redactions/:id/toggle", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const id = Number(req.params.id);
      
      const { redactionService } = await import("./services/redactionService");
      const updated = await redactionService.toggleRegion(id);
      res.json(updated);
    } catch (error) {
      console.error("Toggle redaction error:", error);
      res.status(500).json({ message: "Failed to toggle redaction region" });
    }
  });

  // === CAPTURE ENDPOINTS ===
  
  // Start a capture session for a guide
  app.post("/api/guides/:id/capture/start", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      
      // Verify user has access to the guide
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const member = members.find(m => m.userId === userId);
      const isOwner = workspace.ownerId === userId;
      const canEdit = isOwner || (member && ["admin", "editor", "owner"].includes(member.role));
      
      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to capture for this guide" });
      }
      
      const { captureService } = await import("./services/captureService");
      const result = await captureService.startSession(guideId, userId);
      
      // Check if storage is not configured
      if ('error' in result) {
        return res.status(503).json({ message: result.error });
      }
      
      res.json({
        token: result.token,
        expiresAt: result.expiresAt,
        flowId: result.flowId,
      });
    } catch (error) {
      console.error("Start capture error:", error);
      res.status(500).json({ message: "Failed to start capture session" });
    }
  });

  // Stop a capture session
  app.post("/api/guides/:id/capture/stop", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      
      // Verify user has access to the guide
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const member = members.find(m => m.userId === userId);
      const isOwner = workspace.ownerId === userId;
      const canEdit = isOwner || (member && ["admin", "editor", "owner"].includes(member.role));
      
      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to stop capture for this guide" });
      }
      
      const { captureService } = await import("./services/captureService");
      const session = await captureService.stopSession(guideId, userId);

      if (!session) {
        return res.status(404).json({ message: "No active capture session found" });
      }

      res.json({
        stepsCreated: session.eventsReceived,
        duration: session.stoppedAt ?
          (session.stoppedAt.getTime() - session.startedAt.getTime()) / 1000 : 0,
      });

      // Fire guide-level intelligence analysis in background after capture stops
      if (process.env.ANTHROPIC_API_KEY) {
        setImmediate(() => runGuideIntelligence(guideId));
      }
    } catch (error) {
      console.error("Stop capture error:", error);
      res.status(500).json({ message: "Failed to stop capture session" });
    }
  });

  // Cancel a capture session and delete captured steps
  app.post("/api/guides/:id/capture/cancel", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      
      // Verify user has access to the guide
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const workspace = await storage.getWorkspace(guide.workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      
      const members = await storage.getWorkspaceMembers(guide.workspaceId);
      const member = members.find(m => m.userId === userId);
      const isOwner = workspace.ownerId === userId;
      const canEdit = isOwner || (member && ["admin", "editor", "owner"].includes(member.role));
      
      if (!canEdit) {
        return res.status(403).json({ message: "You don't have permission to cancel capture for this guide" });
      }
      
      const { captureService } = await import("./services/captureService");
      const result = await captureService.cancelSession(guideId, userId);
      
      if (!result) {
        return res.status(404).json({ message: "No active capture session found" });
      }
      
      res.json({
        cancelled: true,
        stepsDeleted: result.deletedSteps,
      });
    } catch (error) {
      console.error("Cancel capture error:", error);
      res.status(500).json({ message: "Failed to cancel capture session" });
    }
  });

  // Get active capture session status
  app.get("/api/guides/:id/capture/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const guideId = Number(req.params.id);
      
      const { captureService } = await import("./services/captureService");
      const session = await captureService.getActiveSession(guideId);
      
      if (!session) {
        return res.json({ active: false });
      }
      
      res.json({
        active: true,
        token: session.userId === (req.user as any).claims.sub ? session.token : undefined,
        eventsReceived: session.eventsReceived,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      console.error("Capture status error:", error);
      res.status(500).json({ message: "Failed to get capture status" });
    }
  });

  // Receive captured events from extension (uses token auth)
  app.post("/api/capture/events", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Missing capture session token" });
      }
      
      const token = authHeader.split(' ')[1];
      const { events } = req.body;
      
      if (!events || !Array.isArray(events)) {
        return res.status(400).json({ message: "Events array is required" });
      }
      
      const { captureService } = await import("./services/captureService");
      const createdSteps = await captureService.processCapturedEvents(token, events);
      
      if (createdSteps.length === 0 && events.length > 0) {
        return res.status(401).json({ message: "Invalid or expired capture session" });
      }
      
      res.json({
        stepsCreated: createdSteps.length,
        steps: createdSteps,
      });
    } catch (error) {
      console.error("Process capture events error:", error);
      res.status(500).json({ message: "Failed to process captured events" });
    }
  });

  // Add a single captured step (alternative to batch)
  app.post("/api/capture/step", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Missing capture session token" });
      }
      
      const token = authHeader.split(' ')[1];
      const stepData = req.body;
      
      const { captureService } = await import("./services/captureService");
      const step = await captureService.addCapturedStep(token, stepData);
      
      if (!step) {
        return res.status(401).json({ message: "Invalid or expired capture session" });
      }
      
      res.json(step);
    } catch (error) {
      console.error("Add captured step error:", error);
      res.status(500).json({ message: "Failed to add captured step" });
    }
  });

  // === STRIPE & CHECKOUT ENDPOINTS ===
  app.get('/api/stripe/config', async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get Stripe config' });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }
      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.json({ data: [] });
    }
  });

  app.post('/api/checkout', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ message: 'Price ID required' });

      const dbUser = await storage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: 'User not found' });

      let customerId = dbUser.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          dbUser.email || user.claims.email || `${userId}@example.com`,
          userId,
          `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || undefined
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/pricing`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ message: error.message || 'Checkout failed' });
    }
  });

  app.post('/api/billing/portal', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const dbUser = await storage.getUser(userId);
      if (!dbUser?.stripeCustomerId) {
        return res.status(400).json({ message: 'No billing account found' });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        dbUser.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal error:', error);
      res.status(500).json({ message: error.message || 'Failed to open billing portal' });
    }
  });

  app.get('/api/subscription', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const dbUser = await storage.getUser(userId);
      if (!dbUser?.stripeSubscriptionId) {
        return res.json({ subscription: null, status: 'inactive' });
      }

      const subscription = await stripeService.getSubscription(dbUser.stripeSubscriptionId);
      res.json({ subscription, status: dbUser.subscriptionStatus || 'inactive' });
    } catch (error) {
      console.error('Subscription error:', error);
      res.json({ subscription: null, status: 'inactive' });
    }
  });

  app.get('/api/billing/plan', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const planInfo = await billingService.getUserPlan(userId);
      res.json(planInfo);
    } catch (error: any) {
      console.error('Get plan error:', error);
      res.status(500).json({ message: error.message || 'Failed to get plan info' });
    }
  });

  app.post('/api/billing/checkout/pro', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const dbUser = await storage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: 'User not found' });

      const additionalSeats = parseInt(req.body.additionalSeats) || 0;
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await billingService.createProCheckoutSession(
        userId,
        dbUser.email || user.claims.email || `${userId}@example.com`,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/pricing`,
        additionalSeats
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Pro checkout error:', error);
      res.status(500).json({ message: error.message || 'Checkout failed' });
    }
  });

  app.post('/api/billing/seats', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const { newSeatCount } = req.body;
      if (typeof newSeatCount !== 'number' || newSeatCount < 1) {
        return res.status(400).json({ message: 'Invalid seat count' });
      }

      const result = await billingService.updateSeatQuantity(userId, newSeatCount);
      res.json(result);
    } catch (error: any) {
      console.error('Seat update error:', error);
      res.status(500).json({ message: error.message || 'Failed to update seats' });
    }
  });

  app.get('/api/billing/can-add-member', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const result = await billingService.canAddMember(userId);
      res.json(result);
    } catch (error: any) {
      console.error('Can add member error:', error);
      res.status(500).json({ message: error.message || 'Failed to check member limits' });
    }
  });

  // === ADMIN ENDPOINTS ===
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };

  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ message: 'Failed to get stats' });
    }
  });

  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const users = await storage.getAllUsers(limit, offset);
      res.json({ data: users });
    } catch (error) {
      console.error('Admin users error:', error);
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (role && !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const updatedUser = await storage.updateUserRole(id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error('Admin update user error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.get('/api/admin/subscriptions', requireAdmin, async (req, res) => {
    try {
      const subscriptions = await stripeService.listSubscriptions();
      res.json({ data: subscriptions });
    } catch (error) {
      console.error('Admin subscriptions error:', error);
      res.json({ data: [] });
    }
  });

  app.get('/api/admin/customers', requireAdmin, async (req, res) => {
    try {
      const customers = await stripeService.listCustomers();
      res.json({ data: customers });
    } catch (error) {
      console.error('Admin customers error:', error);
      res.json({ data: [] });
    }
  });

  app.get('/api/admin/invoices', requireAdmin, async (req, res) => {
    try {
      const invoices = await stripeService.getInvoices();
      res.json({ data: invoices });
    } catch (error) {
      console.error('Admin invoices error:', error);
      res.json({ data: [] });
    }
  });

  // Blog Post Admin Endpoints
  app.get('/api/admin/blog-posts', requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const posts = await storage.getAllBlogPosts(limit, offset);
      res.json({ data: posts });
    } catch (error) {
      console.error('Blog posts error:', error);
      res.status(500).json({ message: 'Failed to get blog posts' });
    }
  });

  app.get('/api/admin/blog-posts/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBlogPost(id);
      if (!post) return res.status(404).json({ message: 'Post not found' });
      res.json(post);
    } catch (error) {
      console.error('Blog post error:', error);
      res.status(500).json({ message: 'Failed to get blog post' });
    }
  });

  app.post('/api/admin/blog-posts', requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.claims.sub;

      const data = insertBlogPostSchema.parse({
        ...req.body,
        authorId: userId,
      });

      const post = await storage.createBlogPost(data);
      res.status(201).json(post);
    } catch (error: any) {
      console.error('Create blog post error:', error);
      res.status(400).json({ message: error.message || 'Failed to create blog post' });
    }
  });

  const updateBlogPostSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    content: z.string().optional(),
    excerpt: z.string().nullable().optional(),
    featuredImageUrl: z.string().nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    publishedAt: z.string().nullable().optional(),
  });

  app.patch('/api/admin/blog-posts/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBlogPost(id);
      if (!post) return res.status(404).json({ message: 'Post not found' });

      const parsed = updateBlogPostSchema.parse(req.body);
      
      if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ message: 'No valid update fields provided' });
      }

      // Convert publishedAt string to Date if present
      const updateData = {
        ...parsed,
        publishedAt: parsed.publishedAt ? new Date(parsed.publishedAt) : parsed.publishedAt === null ? null : undefined,
      };
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const updated = await storage.updateBlogPost(id, updateData as any);
      res.json(updated);
    } catch (error: any) {
      console.error('Update blog post error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(400).json({ message: error.message || 'Failed to update blog post' });
    }
  });

  app.delete('/api/admin/blog-posts/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBlogPost(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete blog post error:', error);
      res.status(500).json({ message: 'Failed to delete blog post' });
    }
  });

  // === ADMIN CONTENT PAGES ===
  app.get('/api/admin/content-pages', requireAdmin, async (req, res) => {
    try {
      const pages = await storage.getAllContentPages();
      res.json({ data: pages });
    } catch (error) {
      console.error('Get content pages error:', error);
      res.status(500).json({ message: 'Failed to get content pages' });
    }
  });

  app.get('/api/admin/content-pages/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const page = await storage.getContentPage(id);
      if (!page) {
        return res.status(404).json({ message: 'Content page not found' });
      }
      res.json(page);
    } catch (error) {
      console.error('Get content page error:', error);
      res.status(500).json({ message: 'Failed to get content page' });
    }
  });

  app.post('/api/admin/content-pages', requireAdmin, async (req, res) => {
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const { title, slug, content, metaDescription, status, showInFooter, footerOrder } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ message: 'Title, slug, and content are required' });
      }

      const existingPage = await storage.getContentPageBySlug(slug);
      if (existingPage) {
        return res.status(400).json({ message: 'A page with this slug already exists' });
      }

      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title', 'width', 'height'],
          a: ['href', 'target', 'rel'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
      });

      let page = await storage.createContentPage({
        title,
        slug: slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        content: sanitizedContent,
        metaDescription: metaDescription || null,
        status: status || 'draft',
        showInFooter: showInFooter !== undefined ? showInFooter : true,
        footerOrder: footerOrder || 0,
        createdById: userId,
        updatedById: userId,
      });

      if (status === 'published') {
        page = await storage.updateContentPage(page.id, { publishedAt: new Date() } as any);
      }

      res.status(201).json(page);
    } catch (error: any) {
      console.error('Create content page error:', error);
      res.status(400).json({ message: error.message || 'Failed to create content page' });
    }
  });

  app.patch('/api/admin/content-pages/:id', requireAdmin, async (req, res) => {
    const user = req.user as any;
    const userId = user.claims.sub;
    const id = parseInt(req.params.id);

    try {
      const existingPage = await storage.getContentPage(id);
      if (!existingPage) {
        return res.status(404).json({ message: 'Content page not found' });
      }

      const { title, slug, content, metaDescription, status, showInFooter, footerOrder } = req.body;

      if (slug && slug !== existingPage.slug) {
        const slugPage = await storage.getContentPageBySlug(slug);
        if (slugPage && slugPage.id !== id) {
          return res.status(400).json({ message: 'A page with this slug already exists' });
        }
      }

      const updateData: any = { updatedById: userId };
      if (title !== undefined) updateData.title = title;
      if (slug !== undefined) updateData.slug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (content !== undefined) {
        updateData.content = sanitizeHtml(content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'title', 'width', 'height'],
            a: ['href', 'target', 'rel'],
          },
          allowedSchemes: ['http', 'https', 'mailto'],
        });
      }
      if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
      if (showInFooter !== undefined) updateData.showInFooter = showInFooter;
      if (footerOrder !== undefined) updateData.footerOrder = footerOrder;
      
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'published' && existingPage.status !== 'published') {
          updateData.publishedAt = new Date();
        } else if (status !== 'published' && existingPage.status === 'published') {
          updateData.publishedAt = null;
        }
      }

      const updated = await storage.updateContentPage(id, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error('Update content page error:', error);
      res.status(400).json({ message: error.message || 'Failed to update content page' });
    }
  });

  app.delete('/api/admin/content-pages/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContentPage(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete content page error:', error);
      res.status(500).json({ message: 'Failed to delete content page' });
    }
  });

  // Public Blog Endpoints
  app.get('/api/blog', async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts(20, 0);
      const publishedPosts = posts.filter(p => p.status === 'published');
      res.json({ data: publishedPosts });
    } catch (error) {
      res.json({ data: [] });
    }
  });

  app.get('/api/blog/:slug', async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post || post.status !== 'published') {
        return res.status(404).json({ message: 'Post not found' });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get post' });
    }
  });

  // === PUBLIC CONTENT PAGES ENDPOINTS ===
  app.get('/api/pages/footer', async (req, res) => {
    try {
      const pages = await storage.getFooterContentPages();
      res.json({ data: pages.map(p => ({ id: p.id, title: p.title, slug: p.slug })) });
    } catch (error) {
      res.json({ data: [] });
    }
  });

  app.get('/api/pages/:slug', async (req, res) => {
    try {
      const page = await storage.getContentPageBySlug(req.params.slug);
      if (!page || page.status !== 'published') {
        return res.status(404).json({ message: 'Page not found' });
      }
      res.json({
        id: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        metaDescription: page.metaDescription,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get page' });
    }
  });

  // === SITE SETTINGS ENDPOINTS ===
  
  // Public settings (for landing page) - only expose safe branding fields
  app.get('/api/settings/public', async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      if (!settings) {
        return res.json({
          siteName: 'FlowCapture',
          siteDescription: 'Automatic workflow documentation',
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          accentColor: '#06b6d4',
        });
      }
      res.json({
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        extensionLink: settings.extensionLink,
        demoLink: settings.demoLink,
        pricingLink: settings.pricingLink,
        docsLink: settings.docsLink,
      });
    } catch (error) {
      res.json({ siteName: 'FlowCapture' });
    }
  });

  // Admin settings endpoints
  app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: 'Failed to get settings' });
    }
  });

  app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.upsertSiteSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // === DISCOUNT CODES ENDPOINTS ===
  
  app.get('/api/admin/discount-codes', requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllDiscountCodes();
      res.json({ data: codes });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get discount codes' });
    }
  });

  app.get('/api/admin/discount-codes/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const code = await storage.getDiscountCode(id);
      if (!code) return res.status(404).json({ message: 'Discount code not found' });
      res.json(code);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get discount code' });
    }
  });

  const createDiscountCodeSchema = z.object({
    code: z.string().min(1).max(50).transform(val => val.toUpperCase()),
    description: z.string().max(200).optional(),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().min(1).max(10000),
    currency: z.string().default('usd'),
    maxRedemptions: z.number().min(1).nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    status: z.enum(['active', 'inactive', 'expired']).default('active'),
  }).refine((data) => {
    if (data.discountType === 'percent' && data.discountValue > 100) {
      return false;
    }
    return true;
  }, {
    message: "Percentage discount cannot exceed 100%",
    path: ["discountValue"],
  });

  app.post('/api/admin/discount-codes', requireAdmin, async (req, res) => {
    try {
      const data = createDiscountCodeSchema.parse(req.body);
      const code = await storage.createDiscountCode(data as any);
      res.status(201).json(code);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(400).json({ message: error.message || 'Failed to create discount code' });
    }
  });

  app.patch('/api/admin/discount-codes/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDiscountCode(id);
      if (!existing) return res.status(404).json({ message: 'Discount code not found' });
      
      const updated = await storage.updateDiscountCode(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update discount code' });
    }
  });

  app.delete('/api/admin/discount-codes/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDiscountCode(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete discount code' });
    }
  });

  // === EMAIL SETTINGS ENDPOINTS ===
  
  app.get('/api/admin/email-settings', requireAdmin, async (req, res) => {
    try {
      const settings = await emailService.getSettings();
      // Don't expose API key to frontend - only show if configured
      res.json({
        ...settings,
        sendgridApiKey: settings?.sendgridApiKey ? '***configured***' : null,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch email settings' });
    }
  });

  app.put('/api/admin/email-settings', requireAdmin, async (req, res) => {
    try {
      const updated = await emailService.updateSettings(req.body);
      res.json({
        ...updated,
        sendgridApiKey: updated?.sendgridApiKey ? '***configured***' : null,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update email settings' });
    }
  });

  app.post('/api/admin/email-settings/test', requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email address required' });
      }
      const success = await emailService.sendTestEmail(email);
      if (success) {
        res.json({ message: 'Test email sent successfully' });
      } else {
        res.status(500).json({ message: 'Failed to send test email - check your SendGrid configuration' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to send test email' });
    }
  });

  // === USER DATA EXPORT (GDPR COMPLIANT) ===
  
  app.get('/api/admin/users/export', requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // CSV header
      const csvHeader = 'ID,Email,First Name,Last Name,Business Name,Role,Email Verified,Subscription Status,Created At\n';
      
      // CSV rows
      const csvRows = allUsers.map(u => {
        const firstName = (u.firstName || '').replace(/,/g, ' ');
        const lastName = (u.lastName || '').replace(/,/g, ' ');
        const businessName = (u.businessName || '').replace(/,/g, ' ');
        const emailVerified = u.emailVerifiedAt ? 'Yes' : 'No';
        const createdAt = u.createdAt ? new Date(u.createdAt).toISOString() : '';
        
        return `${u.id},${u.email || ''},${firstName},${lastName},${businessName},${u.role},${emailVerified},${u.subscriptionStatus || 'inactive'},${createdAt}`;
      }).join('\n');
      
      const csv = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('User export error:', error);
      res.status(500).json({ message: 'Failed to export users' });
    }
  });

  // === STRIPE ADMIN ENDPOINTS ===
  
  app.get('/api/admin/stripe/products', requireAdmin, async (req, res) => {
    try {
      // Get products with their prices using the join query
      const productsWithPrices = await stripeService.listProductsWithPrices(true, 50, 0);
      
      // Group by product and include first price as default
      const productMap = new Map<string, any>();
      for (const row of productsWithPrices as any[]) {
        if (!productMap.has(row.product_id)) {
          productMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            default_price: row.price_id ? {
              id: row.price_id,
              unit_amount: row.unit_amount,
              currency: row.currency,
              recurring: row.recurring,
            } : null,
          });
        }
      }
      
      res.json({ data: Array.from(productMap.values()) });
    } catch (error) {
      console.error('List products error:', error);
      res.status(500).json({ message: 'Failed to list products', data: [] });
    }
  });

  app.get('/api/admin/stripe/prices', requireAdmin, async (req, res) => {
    try {
      const prices = await stripeService.listPrices(true, 50, 0);
      // Format prices for frontend
      const formattedPrices = (prices as any[]).map((p: any) => ({
        id: p.id,
        product: p.product,
        unit_amount: p.unit_amount,
        currency: p.currency,
        active: p.active,
        recurring: p.recurring,
      }));
      res.json({ data: formattedPrices });
    } catch (error) {
      console.error('List prices error:', error);
      res.status(500).json({ message: 'Failed to list prices', data: [] });
    }
  });

  app.post('/api/admin/stripe/products', requireAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Product name is required' });
      }
      const product = await stripeService.createProduct(name, description);
      res.json(product);
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ message: 'Failed to create product' });
    }
  });

  app.post('/api/admin/stripe/prices', requireAdmin, async (req, res) => {
    try {
      const { productId, amount, currency, interval } = req.body;
      if (!productId || !amount) {
        return res.status(400).json({ message: 'Product ID and amount are required' });
      }
      const validInterval = interval === 'year' ? 'year' : 'month';
      const price = await stripeService.createPrice(productId, amount, currency || 'usd', validInterval);
      res.json(price);
    } catch (error) {
      console.error('Create price error:', error);
      res.status(500).json({ message: 'Failed to create price' });
    }
  });

  app.post('/api/admin/stripe/sync', requireAdmin, async (req, res) => {
    try {
      const result = await stripeService.syncStripeData();
      res.json(result);
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ message: 'Failed to sync Stripe data' });
    }
  });

  // === FINANCE ENDPOINTS ===
  
  app.get('/api/admin/finance/overview', requireAdmin, async (req, res) => {
    try {
      const subscriptions = await stripeService.listSubscriptions();
      const invoices = await stripeService.getInvoices();
      
      const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active');
      const totalMRR = activeSubscriptions.reduce((sum: number, sub: any) => {
        const amount = sub.items?.data?.[0]?.price?.unit_amount || 0;
        return sum + (amount / 100);
      }, 0);
      
      const paidInvoices = invoices.filter((inv: any) => inv.status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + ((inv.amount_paid || 0) / 100), 0);
      
      const recentRevenue = paidInvoices
        .filter((inv: any) => {
          const date = new Date(inv.created * 1000);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return date >= thirtyDaysAgo;
        })
        .reduce((sum: number, inv: any) => sum + ((inv.amount_paid || 0) / 100), 0);
      
      res.json({
        mrr: totalMRR,
        arr: totalMRR * 12,
        totalRevenue,
        recentRevenue,
        activeSubscriptionCount: activeSubscriptions.length,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
      });
    } catch (error) {
      console.error('Finance overview error:', error);
      res.json({
        mrr: 0,
        arr: 0,
        totalRevenue: 0,
        recentRevenue: 0,
        activeSubscriptionCount: 0,
        totalInvoices: 0,
        paidInvoices: 0,
      });
    }
  });

  // === EXTENSION ENDPOINTS ===
  app.get(api.extension.getUser.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    res.json({
      id: user.claims.sub,
      username: user.claims.name || user.claims.sub,
      profileImage: user.claims.profile_image || null,
    });
  });

  app.get(api.extension.listWorkspaces.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaces = await storage.getWorkspacesForUser(userId);
    res.json(workspaces.map(w => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
    })));
  });

  app.post(api.extension.syncCapture.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const input = api.extension.syncCapture.input.parse(req.body);
      const { workspaceId, title, steps } = input;

      const guideTitle = title || `Captured Workflow - ${new Date().toLocaleDateString()}`;
      const guide = await storage.createGuide({
        workspaceId,
        title: guideTitle,
        description: `Automatically captured workflow with ${steps.length} steps`,
        status: "draft",
        createdById: userId,
      });

      let stepsCreated = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const actionType = step.type === 'click' ? 'click' :
                          step.type === 'input' ? 'input' :
                          step.type === 'change' ? 'click' :
                          step.type === 'submit' ? 'click' :
                          step.type === 'navigation' ? 'navigation' :
                          step.type === 'element_capture' ? 'custom' : 'custom';

        await storage.createStep({
          flowId: guide.id,
          order: i + 1,
          title: step.description,
          description: step.description,
          actionType: actionType as any,
          selector: step.selector || null,
          url: step.url,
          imageUrl: step.screenshot || null,
          metadata: {
            element: step.element,
            pageTitle: step.pageTitle,
            capturedAt: step.timestamp,
            elementBounds: step.elementBounds || null,
            borderColor: step.borderColor || null,
            isElementCapture: step.isElementCapture || false,
          },
        });
        stepsCreated++;
      }

      res.status(201).json({ guideId: guide.id, stepsCreated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === ANALYTICS API ===
  app.get('/api/analytics', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    
    const emptyAnalytics = {
      totalViews: 0,
      totalGuides: 0,
      avgCompletionRate: 0,
      avgTimeSpent: 0,
      viewsTrend: 0,
      guidesThisWeek: 0,
      guidesTrend: 0,
      draftsTrend: 0,
      topGuides: [],
      recentActivity: [],
    };
    
    if (!workspaceId) {
      return res.json(emptyAnalytics);
    }

    try {
      const analytics = await storage.getWorkspaceAnalytics(workspaceId);
      res.json(analytics);
    } catch (err) {
      console.error("Analytics error:", err);
      res.json(emptyAnalytics);
    }
  });

  // === TEMPLATES API ===
  
  // Default templates data
  const defaultTemplates = [
    {
      title: "Standard Operating Procedure (SOP)",
      description: "Create formal step-by-step procedures with compliance tracking and approval workflows. Perfect for regulated industries.",
      category: "training" as const,
      stepsData: [
        { order: 1, title: "Purpose and Scope", description: "Define the objective and who this SOP applies to.", actionType: "navigation" },
        { order: 2, title: "Prerequisites", description: "List any required permissions, tools, or preparation needed.", actionType: "navigation" },
        { order: 3, title: "Step 1: Initial Action", description: "Describe the first action in the procedure.", actionType: "click" },
        { order: 4, title: "Step 2: Configuration", description: "Configure the necessary settings.", actionType: "input" },
        { order: 5, title: "Step 3: Verification", description: "Verify that the action was completed correctly.", actionType: "click" },
        { order: 6, title: "Completion Checklist", description: "Final verification checklist before marking complete.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Employee Onboarding Guide",
      description: "Welcome new team members with a structured onboarding flow covering tools, access, and first-day essentials.",
      category: "onboarding" as const,
      stepsData: [
        { order: 1, title: "Welcome to the Team!", description: "Introduction to the company and team structure.", actionType: "navigation" },
        { order: 2, title: "Set Up Your Workstation", description: "Configure your computer, email, and essential software.", actionType: "click" },
        { order: 3, title: "Access Company Systems", description: "Log into required platforms and verify access.", actionType: "input" },
        { order: 4, title: "Meet Your Team", description: "Schedule introductory meetings with key colleagues.", actionType: "click" },
        { order: 5, title: "Complete Required Training", description: "Finish mandatory compliance and security training.", actionType: "navigation" },
        { order: 6, title: "First Week Goals", description: "Review your objectives for the first week.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Software Tutorial",
      description: "Teach users how to use a software feature with clear steps, screenshots, and helpful tips.",
      category: "training" as const,
      stepsData: [
        { order: 1, title: "Getting Started", description: "Open the application and navigate to the feature.", actionType: "navigation" },
        { order: 2, title: "Access the Feature", description: "Click on the menu or button to access this feature.", actionType: "click" },
        { order: 3, title: "Configure Settings", description: "Adjust the settings according to your needs.", actionType: "input" },
        { order: 4, title: "Perform the Action", description: "Complete the main action of this tutorial.", actionType: "click" },
        { order: 5, title: "Verify Results", description: "Check that the action completed successfully.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Customer Support Script",
      description: "Guide support agents through common customer issues with scripted responses and escalation paths.",
      category: "support" as const,
      stepsData: [
        { order: 1, title: "Greet the Customer", description: "Open with a friendly, professional greeting.", actionType: "navigation" },
        { order: 2, title: "Identify the Issue", description: "Ask clarifying questions to understand the problem.", actionType: "input" },
        { order: 3, title: "Check Account Status", description: "Verify the customer's account and recent activity.", actionType: "click" },
        { order: 4, title: "Provide Solution", description: "Walk through the resolution steps with the customer.", actionType: "navigation" },
        { order: 5, title: "Escalate if Needed", description: "If unresolved, escalate to the appropriate team.", actionType: "click" },
        { order: 6, title: "Close the Ticket", description: "Document the resolution and close the support ticket.", actionType: "click" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Sales Demo Playbook",
      description: "Structure your product demos with a repeatable flow that highlights key features and closes deals.",
      category: "sales" as const,
      stepsData: [
        { order: 1, title: "Introduction", description: "Introduce yourself and understand the prospect's needs.", actionType: "navigation" },
        { order: 2, title: "Show Key Feature 1", description: "Demonstrate the most impactful feature for this prospect.", actionType: "click" },
        { order: 3, title: "Show Key Feature 2", description: "Highlight another feature that addresses their pain points.", actionType: "click" },
        { order: 4, title: "Handle Objections", description: "Address common questions and concerns.", actionType: "navigation" },
        { order: 5, title: "Pricing Discussion", description: "Present pricing options that fit their budget.", actionType: "navigation" },
        { order: 6, title: "Next Steps", description: "Schedule follow-up and send proposal.", actionType: "click" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Troubleshooting Guide",
      description: "Help users diagnose and fix common problems with structured decision trees and solutions.",
      category: "it" as const,
      stepsData: [
        { order: 1, title: "Identify the Problem", description: "Describe the error message or unexpected behavior.", actionType: "navigation" },
        { order: 2, title: "Check Common Causes", description: "Verify the most likely causes of this issue.", actionType: "click" },
        { order: 3, title: "Try Quick Fix 1", description: "Attempt the first and simplest solution.", actionType: "click" },
        { order: 4, title: "Try Quick Fix 2", description: "If that didn't work, try this alternative solution.", actionType: "click" },
        { order: 5, title: "Advanced Troubleshooting", description: "For persistent issues, try these advanced steps.", actionType: "input" },
        { order: 6, title: "Escalate to Support", description: "If still unresolved, contact technical support.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "HR Policy Walkthrough",
      description: "Explain company policies with clear steps for compliance, requests, and approvals.",
      category: "hr" as const,
      stepsData: [
        { order: 1, title: "Policy Overview", description: "Understand what this policy covers and who it applies to.", actionType: "navigation" },
        { order: 2, title: "Eligibility Requirements", description: "Check if you meet the criteria for this policy.", actionType: "navigation" },
        { order: 3, title: "Submit Request", description: "Fill out the required form to submit your request.", actionType: "input" },
        { order: 4, title: "Manager Approval", description: "Your request will be routed to your manager for approval.", actionType: "navigation" },
        { order: 5, title: "HR Review", description: "HR will review and finalize the request.", actionType: "navigation" },
        { order: 6, title: "Confirmation", description: "You'll receive confirmation once the request is processed.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
    {
      title: "Marketing Campaign Setup",
      description: "Launch marketing campaigns with a structured checklist covering assets, targeting, and tracking.",
      category: "marketing" as const,
      stepsData: [
        { order: 1, title: "Define Campaign Goals", description: "Set clear objectives and KPIs for this campaign.", actionType: "navigation" },
        { order: 2, title: "Create Assets", description: "Prepare all creative assets: images, copy, and landing pages.", actionType: "click" },
        { order: 3, title: "Set Up Targeting", description: "Define your audience segments and targeting criteria.", actionType: "input" },
        { order: 4, title: "Configure Tracking", description: "Set up UTM parameters and conversion tracking.", actionType: "input" },
        { order: 5, title: "Launch Campaign", description: "Publish the campaign and verify everything is live.", actionType: "click" },
        { order: 6, title: "Monitor Performance", description: "Check initial metrics and optimize as needed.", actionType: "navigation" },
      ],
      isPublic: true,
      usageCount: 0,
    },
  ];

  // Seed templates at startup (called once from registerRoutes)
  await storage.seedDefaultTemplates(defaultTemplates);
  
  app.get('/api/templates', async (req, res) => {
    try {
      const templates = await storage.getPublicTemplates();
      res.json(templates);
    } catch (err) {
      console.error("Templates error:", err);
      res.json([]);
    }
  });

  app.post('/api/templates/:id/use', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const templateId = Number(req.params.id);
    const { workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    try {
      const guide = await storage.createGuideFromTemplate(templateId, workspaceId, userId);
      res.status(201).json(guide);
    } catch (err) {
      console.error("Use template error:", err);
      res.status(500).json({ message: "Failed to create guide from template" });
    }
  });

  // === WORKSPACE SETTINGS API ===
  app.get('/api/workspaces/:id/settings', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = Number(req.params.id);

    try {
      const settings = await storage.getWorkspaceSettings(workspaceId);
      res.json(settings || {
        workspaceId,
        autoRedactEmails: false,
        autoRedactPasswords: true,
        autoRedactPhones: false,
        autoRedactCustomPatterns: null,
        defaultLanguage: 'en',
        enableAiDescriptions: true,
        enableAiVoiceover: false,
        brandColor: null,
        customDomain: null,
      });
    } catch (err) {
      console.error("Get workspace settings error:", err);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.patch('/api/workspaces/:id/settings', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = Number(req.params.id);

    try {
      const settings = await storage.updateWorkspaceSettings(workspaceId, req.body);
      res.json(settings);
    } catch (err) {
      console.error("Update workspace settings error:", err);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.post('/api/workspaces/:id/invitations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const workspaceId = Number(req.params.id);

    try {
      const { email, role } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const invitation = await invitationService.createInvitation(
        workspaceId,
        email,
        userId,
        role || 'editor'
      );

      res.status(201).json({ success: true, invitation });
    } catch (err: any) {
      console.error("Create invitation error:", err);
      if (err.message.startsWith('UPGRADE_REQUIRED:') || err.message.startsWith('SEAT_LIMIT:')) {
        return res.status(402).json({ message: err.message });
      }
      res.status(400).json({ message: err.message || 'Failed to create invitation' });
    }
  });

  app.get('/api/workspaces/:id/invitations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = Number(req.params.id);

    try {
      const invitations = await invitationService.getWorkspaceInvitations(workspaceId);
      res.json(invitations);
    } catch (err) {
      console.error("Get invitations error:", err);
      res.status(500).json({ message: 'Failed to get invitations' });
    }
  });

  app.delete('/api/invitations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const invitationId = Number(req.params.id);

    try {
      await invitationService.cancelInvitation(invitationId, userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Cancel invitation error:", err);
      res.status(400).json({ message: err.message || 'Failed to cancel invitation' });
    }
  });

  app.get('/api/invitations/:id', async (req, res) => {
    const invitationId = Number(req.params.id);
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    try {
      const invitation = await invitationService.getInvitationByToken(invitationId, token);
      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found or invalid' });
      }
      res.json(invitation);
    } catch (err) {
      console.error("Get invitation error:", err);
      res.status(500).json({ message: 'Failed to get invitation' });
    }
  });

  app.post('/api/invitations/:id/accept', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;
    const invitationId = Number(req.params.id);
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    try {
      const result = await invitationService.acceptInvitation(invitationId, token, userId);
      res.json(result);
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      res.status(400).json({ message: err.message || 'Failed to accept invitation' });
    }
  });

  app.post('/api/invitations/:id/decline', async (req, res) => {
    const invitationId = Number(req.params.id);
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    try {
      await invitationService.declineInvitation(invitationId, token);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Decline invitation error:", err);
      res.status(400).json({ message: err.message || 'Failed to decline invitation' });
    }
  });

  // === COLLABORATION & TEAM MANAGEMENT ENDPOINTS ===

  // Helper to check workspace membership and role
  async function checkWorkspaceAccess(userId: string, workspaceId: number, requiredRoles?: string[]): Promise<{ allowed: boolean; role?: string }> {
    const members = await storage.getWorkspaceMembers(workspaceId);
    const member = members.find(m => m.userId === userId);
    if (!member) return { allowed: false };
    if (requiredRoles && !requiredRoles.includes(member.role)) return { allowed: false };
    return { allowed: true, role: member.role };
  }

  // --- Step Assignments ---
  app.get('/api/workspaces/:workspaceId/assignments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const assignments = await storage.getAssignmentsByWorkspace(workspaceId);
      res.json({ data: assignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get assignments' });
    }
  });

  app.get('/api/guides/:guideId/assignments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const guideId = parseInt(req.params.guideId);

    try {
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });

      const assignments = await storage.getAssignmentsByGuide(guideId);
      res.json({ data: assignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get assignments' });
    }
  });

  app.get('/api/my-assignments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;

    try {
      const assignments = await storage.getAssignmentsByUser(user.claims.sub);
      res.json({ data: assignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get assignments' });
    }
  });

  app.post('/api/steps/:stepId/assignments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const stepId = parseInt(req.params.stepId);
    const { assigneeId, dueDate, notes } = req.body;

    try {
      const step = await storage.getStepsByGuide(0).then(steps => steps.find(s => s.id === stepId));
      if (!step) {
        const allSteps = await db.select().from(steps).where(eq(steps.id, stepId));
        if (!allSteps[0]) return res.status(404).json({ message: 'Step not found' });
      }
      
      const [stepData] = await db.select().from(steps).where(eq(steps.id, stepId));
      if (!stepData) return res.status(404).json({ message: 'Step not found' });

      const guide = await storage.getGuide(stepData.flowId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId, ['owner', 'admin', 'editor']);
      if (!access.allowed) return res.status(403).json({ message: 'Must be editor or above to assign steps' });

      const assignment = await storage.createStepAssignment({
        stepId,
        flowId: guide.id,
        workspaceId: guide.workspaceId,
        assigneeId,
        assignedById: user.claims.sub,
        status: 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
      });

      // Create notification for assignee
      await storage.createNotification({
        userId: assigneeId,
        type: 'assignment_created',
        title: 'New Step Assignment',
        message: `You have been assigned a step in "${guide.title}"`,
        workspaceId: guide.workspaceId,
        flowId: guide.id,
        stepId,
        referenceId: assignment.id,
        actorId: user.claims.sub,
        isRead: false,
      });

      // Log activity
      await storage.createTeamActivity({
        workspaceId: guide.workspaceId,
        userId: user.claims.sub,
        actionType: 'step_assigned',
        resourceType: 'assignment',
        resourceId: assignment.id,
        metadata: { assigneeId, guideTitle: guide.title },
      });

      res.status(201).json(assignment);
    } catch (error) {
      console.error('Create assignment error:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  app.patch('/api/assignments/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const assignmentId = parseInt(req.params.id);
    const { status, notes, dueDate } = req.body;

    try {
      const assignment = await storage.getStepAssignment(assignmentId);
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

      const isAssignee = assignment.assigneeId === user.claims.sub;
      const access = await checkWorkspaceAccess(user.claims.sub, assignment.workspaceId, ['owner', 'admin', 'editor']);

      if (!isAssignee && !access.allowed) {
        return res.status(403).json({ message: 'Not authorized to update this assignment' });
      }

      const updateData: any = {};
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (notes !== undefined) updateData.notes = notes;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

      const updated = await storage.updateStepAssignment(assignmentId, updateData);

      // Notify relevant parties
      if (status === 'completed') {
        await storage.createNotification({
          userId: assignment.assignedById,
          type: 'assignment_completed',
          title: 'Assignment Completed',
          message: `Step assignment has been completed`,
          workspaceId: assignment.workspaceId,
          flowId: assignment.flowId,
          stepId: assignment.stepId,
          referenceId: assignment.id,
          actorId: user.claims.sub,
          isRead: false,
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update assignment' });
    }
  });

  app.delete('/api/assignments/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const assignmentId = parseInt(req.params.id);

    try {
      const assignment = await storage.getStepAssignment(assignmentId);
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

      const access = await checkWorkspaceAccess(user.claims.sub, assignment.workspaceId, ['owner', 'admin']);
      if (!access.allowed) return res.status(403).json({ message: 'Must be admin to delete assignments' });

      await storage.deleteStepAssignment(assignmentId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete assignment' });
    }
  });

  // --- Guide Approvals ---
  app.get('/api/workspaces/:workspaceId/approvals', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const approvals = await storage.getPendingApprovalsByWorkspace(workspaceId);
      res.json({ data: approvals });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get approvals' });
    }
  });

  app.get('/api/my-approvals', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;

    try {
      const approvals = await storage.getPendingApprovalsByReviewer(user.claims.sub);
      res.json({ data: approvals });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get approvals' });
    }
  });

  app.post('/api/guides/:guideId/request-approval', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const guideId = parseInt(req.params.guideId);
    const { reviewerId, requestNotes } = req.body;

    try {
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const approval = await storage.createGuideApproval({
        flowId: guideId,
        workspaceId: guide.workspaceId,
        requestedById: user.claims.sub,
        reviewerId: reviewerId || null,
        status: 'pending',
        requestNotes: requestNotes || null,
        reviewNotes: null,
      });

      // Notify reviewer(s)
      if (reviewerId) {
        await storage.createNotification({
          userId: reviewerId,
          type: 'approval_requested',
          title: 'Approval Request',
          message: `"${guide.title}" needs your approval`,
          workspaceId: guide.workspaceId,
          flowId: guideId,
          referenceId: approval.id,
          actorId: user.claims.sub,
          isRead: false,
        });
      }

      await storage.createTeamActivity({
        workspaceId: guide.workspaceId,
        userId: user.claims.sub,
        actionType: 'approval_requested',
        resourceType: 'approval',
        resourceId: approval.id,
        metadata: { guideTitle: guide.title },
      });

      res.status(201).json(approval);
    } catch (error) {
      res.status(500).json({ message: 'Failed to request approval' });
    }
  });

  app.post('/api/approvals/:id/review', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const approvalId = parseInt(req.params.id);
    const { status, reviewNotes } = req.body;

    if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    try {
      const approval = await storage.getGuideApproval(approvalId);
      if (!approval) return res.status(404).json({ message: 'Approval not found' });

      const access = await checkWorkspaceAccess(user.claims.sub, approval.workspaceId, ['owner', 'admin']);
      if (!access.allowed) return res.status(403).json({ message: 'Must be admin to review approvals' });

      const updated = await storage.updateGuideApproval(approvalId, {
        status,
        reviewerId: user.claims.sub,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
      } as any);

      // If approved, publish the guide
      if (status === 'approved') {
        await storage.updateGuide(approval.flowId, { status: 'published' });
      }

      // Notify requester
      const notificationType = status === 'approved' ? 'approval_approved' : 
                               status === 'rejected' ? 'approval_rejected' : 'approval_revision';
      const guide = await storage.getGuide(approval.flowId);
      await storage.createNotification({
        userId: approval.requestedById,
        type: notificationType,
        title: status === 'approved' ? 'Guide Approved' : status === 'rejected' ? 'Guide Rejected' : 'Revision Requested',
        message: `"${guide?.title}" has been ${status.replace('_', ' ')}`,
        workspaceId: approval.workspaceId,
        flowId: approval.flowId,
        referenceId: approval.id,
        actorId: user.claims.sub,
        isRead: false,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to review approval' });
    }
  });

  // --- Step Comments ---
  app.get('/api/steps/:stepId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const stepId = parseInt(req.params.stepId);

    try {
      const comments = await storage.getCommentsByStep(stepId);
      res.json({ data: comments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get comments' });
    }
  });

  app.get('/api/guides/:guideId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const guideId = parseInt(req.params.guideId);

    try {
      const comments = await storage.getCommentsByGuide(guideId);
      res.json({ data: comments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get comments' });
    }
  });

  app.post('/api/steps/:stepId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const stepId = parseInt(req.params.stepId);
    const { content, parentId, isEditProposal, proposedContent } = req.body;

    try {
      const [stepData] = await db.select().from(steps).where(eq(steps.id, stepId));
      if (!stepData) return res.status(404).json({ message: 'Step not found' });

      const guide = await storage.getGuide(stepData.flowId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const comment = await storage.createStepComment({
        stepId,
        flowId: guide.id,
        workspaceId: guide.workspaceId,
        authorId: user.claims.sub,
        parentId: parentId || null,
        content,
        isEditProposal: isEditProposal || false,
        proposedContent: proposedContent || null,
        proposalStatus: isEditProposal ? 'pending' : null,
      });

      // Notify guide creator or parent comment author
      const notifyUserId = parentId ? 
        (await storage.getStepComment(parentId))?.authorId : 
        guide.createdById;

      if (notifyUserId && notifyUserId !== user.claims.sub) {
        await storage.createNotification({
          userId: notifyUserId,
          type: parentId ? 'comment_reply' : 'comment_added',
          title: parentId ? 'New Reply' : 'New Comment',
          message: `New ${parentId ? 'reply' : 'comment'} on "${guide.title}"`,
          workspaceId: guide.workspaceId,
          flowId: guide.id,
          stepId,
          referenceId: comment.id,
          actorId: user.claims.sub,
          isRead: false,
        });
      }

      // Check for @mentions
      const mentions = content.match(/@\[([^\]]+)\]\(([^)]+)\)/g);
      if (mentions) {
        for (const mention of mentions) {
          const userId = mention.match(/\(([^)]+)\)/)?.[1];
          if (userId && userId !== user.claims.sub) {
            await storage.createNotification({
              userId,
              type: 'comment_mention',
              title: 'You were mentioned',
              message: `You were mentioned in a comment on "${guide.title}"`,
              workspaceId: guide.workspaceId,
              flowId: guide.id,
              stepId,
              referenceId: comment.id,
              actorId: user.claims.sub,
              isRead: false,
            });
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });

  app.patch('/api/comments/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const commentId = parseInt(req.params.id);
    const { content, proposalStatus } = req.body;

    try {
      const comment = await storage.getStepComment(commentId);
      if (!comment) return res.status(404).json({ message: 'Comment not found' });

      const isAuthor = comment.authorId === user.claims.sub;
      const access = await checkWorkspaceAccess(user.claims.sub, comment.workspaceId, ['owner', 'admin', 'editor']);

      // Authors can edit content, editors+ can update proposal status
      if (!isAuthor && !access.allowed) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const updateData: any = {};
      if (content !== undefined && isAuthor) updateData.content = content;
      if (proposalStatus !== undefined && access.allowed) {
        updateData.proposalStatus = proposalStatus;
        if (proposalStatus === 'accepted' || proposalStatus === 'rejected') {
          updateData.resolvedAt = new Date();
        }
      }

      const updated = await storage.updateStepComment(commentId, updateData);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update comment' });
    }
  });

  app.delete('/api/comments/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const commentId = parseInt(req.params.id);

    try {
      const comment = await storage.getStepComment(commentId);
      if (!comment) return res.status(404).json({ message: 'Comment not found' });

      const isAuthor = comment.authorId === user.claims.sub;
      const access = await checkWorkspaceAccess(user.claims.sub, comment.workspaceId, ['owner', 'admin']);

      if (!isAuthor && !access.allowed) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      await storage.deleteStepComment(commentId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete comment' });
    }
  });

  // --- Notifications ---
  app.get('/api/notifications', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const notifications = await storage.getNotificationsByUser(user.claims.sub, limit);
      const unreadCount = await storage.getUnreadNotificationCount(user.claims.sub);
      res.json({ data: notifications, unreadCount });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  });

  app.post('/api/notifications/:id/read', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const notificationId = parseInt(req.params.id);

    try {
      await storage.markNotificationRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to mark notification read' });
    }
  });

  app.post('/api/notifications/read-all', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;

    try {
      await storage.markAllNotificationsRead(user.claims.sub);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to mark notifications read' });
    }
  });

  // --- Team Dashboard ---
  app.get('/api/workspaces/:workspaceId/team-dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const stats = await storage.getTeamDashboardStats(workspaceId);
      const members = await storage.getWorkspaceMembers(workspaceId);

      // Get per-user stats
      const memberStats = await Promise.all(members.map(async (member) => {
        const assignments = await storage.getAssignmentsByUser(member.userId);
        const workspaceAssignments = assignments.filter(a => a.workspaceId === workspaceId);
        return {
          userId: member.userId,
          user: member.user,
          role: member.role,
          totalAssignments: workspaceAssignments.length,
          completedAssignments: workspaceAssignments.filter(a => a.status === 'completed').length,
          pendingAssignments: workspaceAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress').length,
        };
      }));

      res.json({
        ...stats,
        members: memberStats,
      });
    } catch (error) {
      console.error('Team dashboard error:', error);
      res.status(500).json({ message: 'Failed to get team dashboard' });
    }
  });

  app.get('/api/workspaces/:workspaceId/activity', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const activity = await storage.getTeamActivityByWorkspace(workspaceId, limit);
      res.json({ data: activity });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get activity' });
    }
  });

  // === INTEGRATIONS ===
  
  app.get('/api/workspaces/:workspaceId/integrations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const integrationsList = await integrationsService.getIntegrationsByWorkspace(workspaceId);
      res.json({ data: integrationsList });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get integrations' });
    }
  });

  app.post('/api/workspaces/:workspaceId/integrations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const integration = await integrationsService.createIntegration({
        ...req.body,
        workspaceId,
        createdById: user.claims.sub
      });
      res.status(201).json(integration);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create integration' });
    }
  });

  app.put('/api/workspaces/:workspaceId/integrations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const integrationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const integration = await integrationsService.updateIntegration(integrationId, req.body);
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update integration' });
    }
  });

  app.delete('/api/workspaces/:workspaceId/integrations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const integrationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      await integrationsService.deleteIntegration(integrationId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete integration' });
    }
  });

  // Validate integration credentials before saving
  app.post('/api/workspaces/:workspaceId/integrations/validate', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { provider, config } = req.body;
      if (!provider || !config) {
        return res.status(400).json({ message: 'Provider and config are required' });
      }

      const result = await validateIntegrationCredentials(provider, config);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to validate credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test an existing integration
  app.post('/api/workspaces/:workspaceId/integrations/:id/test', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const integrationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const integration = await integrationsService.getIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      const config = integration.credentials as Record<string, string>;
      const result = await validateIntegrationCredentials(integration.provider, config);
      
      // Update integration status based on test result
      await integrationsService.updateIntegrationStatus(
        integrationId, 
        result.success ? 'active' : 'error',
        result.success ? undefined : result.error
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test integration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Trigger integration sync for a specific guide
  app.post('/api/workspaces/:workspaceId/integrations/:id/sync', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const integrationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { guideId, action } = req.body;
      if (!guideId) {
        return res.status(400).json({ message: 'Guide ID is required' });
      }

      const integration = await integrationsService.getIntegration(integrationId);
      if (!integration || integration.status !== 'active') {
        return res.status(400).json({ message: 'Integration not found or inactive' });
      }

      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: 'Guide not found' });
      }

      const credentials = integration.credentials as Record<string, string>;
      const result = await triggerIntegrationSync(
        integration.provider, 
        guide, 
        credentials, 
        action || 'published'
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to sync integration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Trigger all active integrations for a guide (called when guide is published)
  app.post('/api/workspaces/:workspaceId/guides/:guideId/sync-integrations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const guideId = parseInt(req.params.guideId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const guide = await storage.getGuide(guideId);
      if (!guide || guide.workspaceId !== workspaceId) {
        return res.status(404).json({ message: 'Guide not found' });
      }

      const action = req.body.action || 'published';
      const integrations = await integrationsService.getIntegrationsByWorkspace(workspaceId);
      const activeIntegrations = integrations.filter(i => i.status === 'active');

      const results = await Promise.all(
        activeIntegrations.map(async (integration) => {
          const credentials = integration.credentials as Record<string, string>;
          const result = await triggerIntegrationSync(integration.provider, guide, credentials, action);
          return {
            integrationId: integration.id,
            provider: integration.provider,
            name: integration.name,
            ...result
          };
        })
      );

      res.json({ 
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results 
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to sync integrations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // === WEBHOOKS ===

  app.get('/api/workspaces/:workspaceId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const webhooksList = await integrationsService.getWebhooksByWorkspace(workspaceId);
      res.json({ data: webhooksList });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get webhooks' });
    }
  });

  app.post('/api/workspaces/:workspaceId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const webhook = await integrationsService.createWebhook({
        ...req.body,
        workspaceId,
        createdById: user.claims.sub
      });
      res.status(201).json(webhook);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create webhook' });
    }
  });

  app.put('/api/workspaces/:workspaceId/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const webhookId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const webhook = await integrationsService.updateWebhook(webhookId, req.body);
      res.json(webhook);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update webhook' });
    }
  });

  app.delete('/api/workspaces/:workspaceId/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const webhookId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      await integrationsService.deleteWebhook(webhookId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete webhook' });
    }
  });

  app.get('/api/workspaces/:workspaceId/webhooks/:id/logs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const webhookId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const logs = await integrationsService.getWebhookLogs(webhookId);
      res.json({ data: logs });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get webhook logs' });
    }
  });

  // === AUTOMATIONS ===

  app.get('/api/workspaces/:workspaceId/automations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const automationsList = await integrationsService.getAutomationsByWorkspace(workspaceId);
      res.json({ data: automationsList });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get automations' });
    }
  });

  app.post('/api/workspaces/:workspaceId/automations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const automation = await integrationsService.createAutomation({
        ...req.body,
        workspaceId,
        createdById: user.claims.sub
      });
      res.status(201).json(automation);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create automation' });
    }
  });

  app.put('/api/workspaces/:workspaceId/automations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const automationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const automation = await integrationsService.updateAutomation(automationId, req.body);
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update automation' });
    }
  });

  app.delete('/api/workspaces/:workspaceId/automations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const automationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      await integrationsService.deleteAutomation(automationId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete automation' });
    }
  });

  app.get('/api/workspaces/:workspaceId/automations/:id/logs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const automationId = parseInt(req.params.id);

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const logs = await integrationsService.getAutomationLogs(automationId);
      res.json({ data: logs });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get automation logs' });
    }
  });

  // === ANALYTICS EVENTS ===

  app.post('/api/analytics/track', async (req, res) => {
    try {
      const user = req.isAuthenticated() ? (req.user as any) : null;
      
      await integrationsService.trackEvent({
        workspaceId: req.body.workspaceId || null,
        userId: user?.claims?.sub || null,
        sessionId: req.body.sessionId || null,
        eventName: req.body.eventName,
        eventCategory: req.body.eventCategory || null,
        eventData: req.body.eventData || null,
        source: req.body.source || 'web',
        referrer: req.headers.referer || null,
        userAgent: req.headers['user-agent'] || null,
        ipHash: null // Would hash IP for privacy
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to track event' });
    }
  });

  app.get('/api/workspaces/:workspaceId/analytics', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.params.workspaceId);
    const limit = parseInt(req.query.limit as string) || 100;
    const eventName = req.query.eventName as string | undefined;

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Not a workspace member' });

      const events = await integrationsService.getAnalyticsEvents(workspaceId, { limit, eventName });
      res.json({ data: events });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get analytics' });
    }
  });

  // === VERSION HISTORY ENDPOINTS ===

  app.get('/api/guides/:guideId/versions', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const guideId = parseInt(req.params.guideId);
    const user = req.user as any;

    try {
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: "Guide not found" });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Access denied' });

      const versions = await db.select().from(guideVersions)
        .where(eq(guideVersions.flowId, guideId))
        .orderBy(desc(guideVersions.versionNumber));
      res.json(versions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get versions' });
    }
  });

  app.post('/api/guides/:guideId/versions', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const guideId = parseInt(req.params.guideId);
    const user = req.user as any;
    const { changeNotes } = req.body;

    try {
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: "Guide not found" });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId);
      if (!access.allowed || access.role === 'viewer') {
        return res.status(403).json({ message: 'Edit access required' });
      }

      const stepsList = await storage.getStepsByGuide(guideId);
      const existingVersions = await db.select().from(guideVersions)
        .where(eq(guideVersions.flowId, guideId));
      const nextVersion = existingVersions.length + 1;

      const [version] = await db.insert(guideVersions).values({
        flowId: guideId,
        versionNumber: nextVersion,
        title: guide.title,
        description: guide.description,
        stepsSnapshot: stepsList,
        changeNotes: changeNotes || null,
        createdById: user.claims.sub
      }).returning();

      res.json(version);
    } catch (error) {
      res.status(500).json({ message: 'Failed to save version' });
    }
  });

  app.post('/api/guides/:guideId/versions/:versionId/restore', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const guideId = parseInt(req.params.guideId);
    const versionId = parseInt(req.params.versionId);
    const user = req.user as any;

    try {
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: "Guide not found" });

      const access = await checkWorkspaceAccess(user.claims.sub, guide.workspaceId);
      if (!access.allowed || access.role === 'viewer') {
        return res.status(403).json({ message: 'Edit access required' });
      }

      const [version] = await db.select().from(guideVersions)
        .where(eq(guideVersions.id, versionId));
      if (!version || version.flowId !== guideId) {
        return res.status(404).json({ message: "Version not found" });
      }

      await storage.updateGuide(guideId, {
        title: version.title,
        description: version.description
      });

      const currentSteps = await storage.getStepsByGuide(guideId);
      for (const step of currentSteps) {
        await storage.deleteStep(step.id);
      }

      const stepsSnapshot = version.stepsSnapshot as any[];
      if (stepsSnapshot && Array.isArray(stepsSnapshot)) {
        for (let idx = 0; idx < stepsSnapshot.length; idx++) {
          const stepData = stepsSnapshot[idx];
          await storage.createStep({
            flowId: guideId,
            order: typeof stepData.order === 'number' ? stepData.order : idx,
            title: stepData.title || null,
            description: stepData.description || null,
            actionType: stepData.actionType || 'click',
            selector: stepData.selector || null,
            url: stepData.url || stepData.pageUrl || null,
            imageUrl: stepData.imageUrl || null
          });
        }
      }

      res.json({ success: true, restoredVersion: version.versionNumber });
    } catch (error) {
      console.error("Restore version error:", error);
      res.status(500).json({ message: 'Failed to restore version' });
    }
  });

  // === INTERACTIVE DEMO ENDPOINT ===

  app.get('/api/share/:token/demo', async (req, res) => {
    try {
      const { token } = req.params;
      const guideShare = await storage.getGuideShareByToken(token);
      
      if (!guideShare || !guideShare.enabled) {
        return res.status(404).json({ message: "Demo not available" });
      }

      const guide = await storage.getGuide(guideShare.flowId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }

      const stepsList = await storage.getStepsByGuide(guide.id);
      res.json({
        guide: {
          id: guide.id,
          title: guide.title,
          description: guide.description
        },
        steps: stepsList.map((s: any) => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl,
          actionType: s.actionType,
          selector: s.selector
        }))
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load demo' });
    }
  });

  // === WEBHOOKS ENDPOINTS ===

  app.get('/api/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const workspaceId = parseInt(req.query.workspaceId as string);

    if (!workspaceId || isNaN(workspaceId)) return res.status(400).json({ message: "Valid workspaceId required" });

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed) return res.status(403).json({ message: 'Access denied' });

      const webhooksList = await integrationsService.getWebhooksByWorkspace(workspaceId);
      res.json(webhooksList);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get webhooks' });
    }
  });

  app.post('/api/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const { workspaceId, name, url, events } = req.body;

    try {
      const access = await checkWorkspaceAccess(user.claims.sub, workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const webhook = await integrationsService.createWebhook({
        workspaceId,
        name,
        url,
        events,
        isActive: true,
        createdById: user.claims.sub
      });
      res.json(webhook);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create webhook' });
    }
  });

  app.patch('/api/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const webhookId = parseInt(req.params.id);

    try {
      const webhook = await integrationsService.getWebhook(webhookId);
      if (!webhook) return res.status(404).json({ message: "Webhook not found" });

      const access = await checkWorkspaceAccess(user.claims.sub, webhook.workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const updated = await integrationsService.updateWebhook(webhookId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update webhook' });
    }
  });

  app.delete('/api/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const webhookId = parseInt(req.params.id);

    try {
      const webhook = await integrationsService.getWebhook(webhookId);
      if (!webhook) return res.status(404).json({ message: "Webhook not found" });

      const access = await checkWorkspaceAccess(user.claims.sub, webhook.workspaceId);
      if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      await integrationsService.deleteWebhook(webhookId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete webhook' });
    }
  });

  // === KNOWLEDGE BASE - PUBLIC ROUTES ===

  // Default KB branding settings
  const defaultKbBranding = {
    logoUrl: '',
    primaryColor: '#3b82f6',
    accentColor: '#8b5cf6',
    headerTitle: 'Help Center',
    headerSubtitle: 'Find answers to your questions',
    showSearch: true,
    showCategories: true,
  };

  // Get KB branding settings (public)
  app.get('/api/kb/branding', async (req, res) => {
    try {
      const branding = await storage.getKbBranding();
      // Merge with defaults to ensure all fields are present (handle null values)
      const mergedBranding = branding ? {
        logoUrl: branding.logoUrl ?? defaultKbBranding.logoUrl,
        primaryColor: branding.primaryColor ?? defaultKbBranding.primaryColor,
        accentColor: branding.accentColor ?? defaultKbBranding.accentColor,
        headerTitle: branding.headerTitle ?? defaultKbBranding.headerTitle,
        headerSubtitle: branding.headerSubtitle ?? defaultKbBranding.headerSubtitle,
        showSearch: branding.showSearch ?? defaultKbBranding.showSearch,
        showCategories: branding.showCategories ?? defaultKbBranding.showCategories,
      } : defaultKbBranding;
      res.json(mergedBranding);
    } catch (error) {
      console.error('Error fetching KB branding:', error);
      res.json(defaultKbBranding);
    }
  });

  // Update KB branding settings (authenticated admin only)
  app.put('/api/kb/branding', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });
    if (dbUser.role !== 'admin') return res.status(403).json({ message: "Admin access required" });

    try {
      const { logoUrl, primaryColor, accentColor, headerTitle, headerSubtitle, showSearch, showCategories } = req.body;
      
      // Get existing branding to merge with, defaulting to defaults if none exists
      const existing = await storage.getKbBranding() ?? defaultKbBranding;
      
      // Only update fields that are explicitly provided (not undefined)
      const updated = await storage.upsertKbBranding({
        logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
        primaryColor: primaryColor !== undefined ? primaryColor : existing.primaryColor,
        accentColor: accentColor !== undefined ? accentColor : existing.accentColor,
        headerTitle: headerTitle !== undefined ? headerTitle : existing.headerTitle,
        headerSubtitle: headerSubtitle !== undefined ? headerSubtitle : existing.headerSubtitle,
        showSearch: showSearch !== undefined ? showSearch : existing.showSearch,
        showCategories: showCategories !== undefined ? showCategories : existing.showCategories,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating KB branding:', error);
      res.status(500).json({ message: 'Failed to update branding settings' });
    }
  });

  // Get all active categories (public)
  app.get('/api/kb/categories', async (req, res) => {
    try {
      const categories = await storage.getActiveKbCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching KB categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Get category by slug (public)
  app.get('/api/kb/categories/:slug', async (req, res) => {
    try {
      const category = await storage.getKbCategoryBySlug(req.params.slug);
      if (!category) return res.status(404).json({ message: 'Category not found' });
      res.json(category);
    } catch (error) {
      console.error('Error fetching KB category:', error);
      res.status(500).json({ message: 'Failed to fetch category' });
    }
  });

  // Get published articles (public, optionally filtered by category)
  app.get('/api/kb/articles', async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const articles = await storage.getPublishedKbArticles(categoryId);
      res.json(articles);
    } catch (error) {
      console.error('Error fetching KB articles:', error);
      res.status(500).json({ message: 'Failed to fetch articles' });
    }
  });

  // Search articles (public)
  app.get('/api/kb/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const articles = await storage.searchKbArticles(query);
      res.json(articles);
    } catch (error) {
      console.error('Error searching KB articles:', error);
      res.status(500).json({ message: 'Failed to search articles' });
    }
  });

  // Get article by slug (public)
  app.get('/api/kb/articles/:slug', async (req, res) => {
    try {
      const article = await storage.getKbArticleBySlug(req.params.slug);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      if (article.status !== 'published') {
        return res.status(404).json({ message: 'Article not found' });
      }
      // Increment view count
      await storage.incrementKbArticleViewCount(article.id);
      res.json(article);
    } catch (error) {
      console.error('Error fetching KB article:', error);
      res.status(500).json({ message: 'Failed to fetch article' });
    }
  });

  // Submit article feedback (public)
  app.post('/api/kb/articles/:id/feedback', async (req, res) => {
    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });
      
      const { helpful } = req.body;
      if (typeof helpful !== 'boolean') {
        return res.status(400).json({ message: 'Helpful field must be a boolean' });
      }
      
      await storage.updateKbArticleHelpfulness(articleId, helpful);
      res.json({ success: true });
    } catch (error) {
      console.error('Error submitting article feedback:', error);
      res.status(500).json({ message: 'Failed to submit feedback' });
    }
  });

  // === KNOWLEDGE BASE - AUTHENTICATED USER ROUTES ===

  // Get all articles for current user (for KB manager)
  app.get('/api/kb/articles/manage', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      // Get all articles - if admin, return all, otherwise only user's articles
      const allArticles = await storage.getAllKbArticles();
      
      if (dbUser.role === 'admin') {
        res.json(allArticles);
      } else {
        // Filter to only return articles authored by this user
        const userArticles = allArticles.filter(a => a.authorId === dbUser.id);
        res.json(userArticles);
      }
    } catch (error) {
      console.error('Error fetching KB articles:', error);
      res.status(500).json({ message: 'Failed to fetch articles' });
    }
  });

  // Create KB article
  app.post('/api/kb/articles', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      const { title, excerpt, content, categoryId, status, tags } = req.body;
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }

      // Generate slug
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);

      const article = await storage.createKbArticle({
        categoryId: categoryId || null,
        title,
        slug,
        excerpt: excerpt || null,
        content: content || '',
        status: status || 'draft',
        tags: tags || [],
        authorId: dbUser.id,
        readingTimeMinutes: Math.max(1, Math.ceil((content?.split(' ')?.length || 0) / 200)),
      });

      res.status(201).json(article);
    } catch (error) {
      console.error('Error creating KB article:', error);
      res.status(500).json({ message: 'Failed to create article' });
    }
  });

  // Update KB article
  app.patch('/api/kb/articles/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });

      // Verify user has access to this article (must be author or admin)
      const article = await storage.getKbArticle(articleId);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      
      if (article.authorId !== dbUser.id && dbUser.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updates: any = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.excerpt !== undefined) updates.excerpt = req.body.excerpt;
      if (req.body.content !== undefined) {
        updates.content = req.body.content;
        updates.readingTimeMinutes = Math.max(1, Math.ceil((req.body.content.split(' ')?.length || 0) / 200));
      }
      if (req.body.categoryId !== undefined) updates.categoryId = req.body.categoryId;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;

      const updated = await storage.updateKbArticle(articleId, updates);
      res.json(updated);
    } catch (error) {
      console.error('Error updating KB article:', error);
      res.status(500).json({ message: 'Failed to update article' });
    }
  });

  // Delete KB article
  app.delete('/api/kb/articles/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });

      // Verify user has access to this article (must be author or admin)
      const article = await storage.getKbArticle(articleId);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      
      if (article.authorId !== dbUser.id && dbUser.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteKbArticle(articleId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting KB article:', error);
      res.status(500).json({ message: 'Failed to delete article' });
    }
  });

  // Create KB category (authenticated user)
  app.post('/api/kb/categories', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      // Generate slug
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);

      const category = await storage.createKbCategory({
        name,
        slug,
        description: description || null,
        icon: null,
        color: null,
        order: 0,
        isActive: true,
      });

      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating KB category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  // Delete KB category
  app.delete('/api/kb/categories/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) return res.status(400).json({ message: 'Invalid category ID' });

      await storage.deleteKbCategory(categoryId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting KB category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // === KNOWLEDGE BASE - ADMIN ROUTES ===

  // Get all categories (admin)
  app.get('/api/admin/kb/categories', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const categories = await storage.getAllKbCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching KB categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Create category (admin)
  app.post('/api/admin/kb/categories', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const { name, slug, description, icon, color, order, isActive } = req.body;
      if (!name || !slug) {
        return res.status(400).json({ message: 'Name and slug are required' });
      }
      
      const category = await storage.createKbCategory({
        name,
        slug,
        description,
        icon,
        color,
        order: order || 0,
        isActive: isActive !== false
      });
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating KB category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  // Update category (admin)
  app.patch('/api/admin/kb/categories/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) return res.status(400).json({ message: 'Invalid category ID' });
      
      const category = await storage.updateKbCategory(categoryId, req.body);
      res.json(category);
    } catch (error) {
      console.error('Error updating KB category:', error);
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  // Delete category (admin)
  app.delete('/api/admin/kb/categories/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) return res.status(400).json({ message: 'Invalid category ID' });
      
      await storage.deleteKbCategory(categoryId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting KB category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // Get all articles (admin)
  app.get('/api/admin/kb/articles', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const articles = await storage.getAllKbArticles(limit, offset);
      res.json(articles);
    } catch (error) {
      console.error('Error fetching KB articles:', error);
      res.status(500).json({ message: 'Failed to fetch articles' });
    }
  });

  // Get article by ID (admin)
  app.get('/api/admin/kb/articles/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });
      
      const article = await storage.getKbArticle(articleId);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      res.json(article);
    } catch (error) {
      console.error('Error fetching KB article:', error);
      res.status(500).json({ message: 'Failed to fetch article' });
    }
  });

  // Create article (admin)
  app.post('/api/admin/kb/articles', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const { title, slug, content, excerpt, categoryId, featuredImageUrl, status, metaDescription, tags, sourceGuideId, sourceType, readingTimeMinutes } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ message: 'Title, slug, and content are required' });
      }
      
      const article = await storage.createKbArticle({
        title,
        slug,
        content,
        excerpt,
        categoryId,
        featuredImageUrl,
        status: status || 'draft',
        authorId: user.claims.sub,
        metaDescription,
        tags,
        sourceGuideId,
        sourceType,
        readingTimeMinutes,
        publishedAt: status === 'published' ? new Date() : null
      });
      res.status(201).json(article);
    } catch (error) {
      console.error('Error creating KB article:', error);
      res.status(500).json({ message: 'Failed to create article' });
    }
  });

  // Update article (admin)
  app.patch('/api/admin/kb/articles/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });
      
      const existingArticle = await storage.getKbArticle(articleId);
      if (!existingArticle) return res.status(404).json({ message: 'Article not found' });
      
      const updates = { ...req.body };
      
      // Set publishedAt when publishing for the first time
      if (updates.status === 'published' && existingArticle.status !== 'published') {
        updates.publishedAt = new Date();
      }
      
      const article = await storage.updateKbArticle(articleId, updates);
      res.json(article);
    } catch (error) {
      console.error('Error updating KB article:', error);
      res.status(500).json({ message: 'Failed to update article' });
    }
  });

  // Delete article (admin)
  app.delete('/api/admin/kb/articles/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) return res.status(400).json({ message: 'Invalid article ID' });
      
      await storage.deleteKbArticle(articleId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting KB article:', error);
      res.status(500).json({ message: 'Failed to delete article' });
    }
  });

  // KB Article Embed Info (public)
  app.get('/api/kb/articles/:slug/embed', allowIframe, async (req, res) => {
    try {
      const article = await storage.getKbArticleBySlug(req.params.slug);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      if (article.status !== 'published') {
        return res.status(404).json({ message: 'Article not found' });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const articleUrl = `${baseUrl}/help/article/${article.slug}`;
      const embedUrl = `${baseUrl}/help/embed/${article.slug}`;
      
      const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`;
      
      res.json({
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
        },
        shareUrl: articleUrl,
        embedUrl,
        embedCode,
      });
    } catch (error) {
      console.error('Error generating KB article embed:', error);
      res.status(500).json({ message: 'Failed to generate embed code' });
    }
  });

  // Convert user's own guide to KB article (authenticated users)
  app.post('/api/guides/:guideId/convert-to-kb', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const guideId = parseInt(req.params.guideId);
      if (isNaN(guideId)) return res.status(400).json({ message: 'Invalid guide ID' });
      
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });
      
      // Verify user owns this guide or is in the workspace
      if (guide.createdById !== userId) {
        // Check workspace membership
        const members = await storage.getWorkspaceMembers(guide.workspaceId);
        const isMember = members.some((m: any) => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ message: 'Not authorized to convert this guide' });
        }
      }
      
      const stepsData = await storage.getStepsByGuide(guideId);
      
      // Generate professional HTML content from guide steps
      let content = '';
      if (guide.description) {
        content += `<p class="lead">${guide.description}</p>\n\n`;
      }
      
      stepsData.forEach((step, index) => {
        content += `<div class="step-container">\n`;
        content += `<h2><span class="step-number">${index + 1}</span>${step.title || 'Step ' + (index + 1)}</h2>\n`;
        if (step.description) {
          content += `<p>${step.description}</p>\n`;
        }
        if (step.imageUrl) {
          content += `<figure class="step-image">\n`;
          content += `<img src="${step.imageUrl}" alt="${step.title || 'Step ' + (index + 1)}" />\n`;
          content += `</figure>\n`;
        }
        content += `</div>\n\n`;
      });
      
      // Generate unique slug from title
      const baseSlug = guide.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Date.now()}`;
      
      const { categoryId, title, excerpt, tags } = req.body;
      
      const article = await storage.createKbArticle({
        title: title || guide.title,
        slug,
        content,
        excerpt: excerpt || guide.description?.substring(0, 200),
        categoryId: categoryId || null,
        featuredImageUrl: guide.coverImageUrl,
        status: 'draft',
        authorId: userId,
        sourceGuideId: guideId,
        sourceType: 'guide_conversion',
        tags: tags || [],
        readingTimeMinutes: Math.max(1, Math.ceil(stepsData.length * 0.5))
      });
      
      res.status(201).json(article);
    } catch (error) {
      console.error('Error converting guide to KB article:', error);
      res.status(500).json({ message: 'Failed to convert guide to article' });
    }
  });

  // Convert guide to KB article (admin)
  app.post('/api/admin/kb/articles/from-guide/:guideId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const guideId = parseInt(req.params.guideId);
      if (isNaN(guideId)) return res.status(400).json({ message: 'Invalid guide ID' });
      
      const guide = await storage.getGuide(guideId);
      if (!guide) return res.status(404).json({ message: 'Guide not found' });
      
      const stepsData = await storage.getStepsByGuide(guideId);
      
      // Generate content from guide steps
      let content = `<h1>${guide.title}</h1>\n`;
      if (guide.description) {
        content += `<p>${guide.description}</p>\n`;
      }
      content += '\n';
      
      stepsData.forEach((step, index) => {
        content += `<h2>Step ${index + 1}: ${step.title || 'Untitled Step'}</h2>\n`;
        if (step.description) {
          content += `<p>${step.description}</p>\n`;
        }
        if (step.imageUrl) {
          content += `<img src="${step.imageUrl}" alt="${step.title || 'Step image'}" />\n`;
        }
        content += '\n';
      });
      
      // Generate slug from title
      const baseSlug = guide.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Date.now()}`;
      
      const { categoryId } = req.body;
      
      const article = await storage.createKbArticle({
        title: guide.title,
        slug,
        content,
        excerpt: guide.description?.substring(0, 200),
        categoryId,
        featuredImageUrl: guide.coverImageUrl,
        status: 'draft',
        authorId: user.claims.sub,
        sourceGuideId: guideId,
        sourceType: 'guide_conversion',
        readingTimeMinutes: Math.max(1, Math.ceil(stepsData.length * 0.5))
      });
      
      res.status(201).json(article);
    } catch (error) {
      console.error('Error converting guide to KB article:', error);
      res.status(500).json({ message: 'Failed to convert guide to article' });
    }
  });

  // ── SSE real-time event stream ──────────────────────────────────────────────
  // Clients connect here to receive push notifications (guide updates, new steps,
  // workspace changes) without polling.
  const sseClients = new Map<string, Set<Response>>();

  function ssePublish(userId: string, event: string, data: unknown) {
    const clients = sseClients.get(userId);
    if (!clients) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of Array.from(clients)) {
      try { res.write(payload); } catch { /* client disconnected */ }
    }
  }

  // Expose publisher so other route handlers can call it
  (app as any)._ssePublish = ssePublish;

  app.get('/api/events', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = (req as any).user;
    const userId = user.claims.sub as string;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // Send initial ping so the client knows the connection is live
    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId)!.add(res);

    // Heartbeat every 25s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(userId)?.delete(res);
    });
  });

  return httpServer;
}

// Seed function to create initial data if needed
async function seedDatabase() {
  // We can add some logic here to check if specific system data exists
  console.log("Database seeded successfully.");
}
