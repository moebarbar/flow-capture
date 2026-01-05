import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { openai } from "./replit_integrations/image/client";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { insertBlogPostSchema, users } from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { emailService } from "./services/emailService";
import { billingService } from "./services/billingService";
import { invitationService } from "./services/invitationService";
import { db } from "./db";
import sanitizeHtml from "sanitize-html"; 

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === SECURITY MIDDLEWARE ===
  // Helmet for secure headers (XSS protection, etc.)
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false,
  }));

  // Rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: { message: "Too many attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to sensitive auth endpoints
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Setup other integrations
  registerObjectStorageRoutes(app);
  registerChatRoutes(app);
  registerImageRoutes(app);

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
    const workspace = await storage.getWorkspace(Number(req.params.id));
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    // TODO: Check if user is member
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

  // === GUIDES ===
  app.get(api.guides.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    
    if (!workspaceId) {
       // Allow getting all guides for user across workspaces? For now, require workspaceId or return empty
       return res.json([]);
    }

    const guides = await storage.getGuidesByWorkspace(workspaceId);
    res.json(guides);
  });

  app.post(api.guides.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const userId = user.claims.sub;

    try {
      const input = api.guides.create.input.parse({ ...req.body, createdById: userId });
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
    // Public guides? For now require auth except if published maybe
    // if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const guide = await storage.getGuide(Number(req.params.id));
    if (!guide) return res.status(404).json({ message: "Guide not found" });

    const steps = await storage.getStepsByGuide(guide.id);
    res.json({ ...guide, steps });
  });

  app.put(api.guides.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = api.guides.update.input.parse(req.body);
      const guide = await storage.updateGuide(Number(req.params.id), input);
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
    await storage.deleteGuide(Number(req.params.id));
    res.status(204).send();
  });

  // === STEPS ===
  app.get(api.steps.list.path, async (req, res) => {
    const steps = await storage.getStepsByGuide(Number(req.params.guideId));
    res.json(steps);
  });

  app.post(api.steps.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = api.steps.create.input.parse(req.body);
      const step = await storage.createStep(input);
      res.status(201).json(step);
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
      guideId,
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
      
      const guide = await storage.getGuide(share.guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      res.json({
        title: guide.title,
        requiresPassword: !!share.passwordHash,
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
      const { password } = req.body;
      
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
      
      const guide = await storage.getGuide(share.guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const steps = await storage.getStepsByGuide(share.guideId);
      
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
  app.get('/api/embed/:token', async (req, res) => {
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
      
      const guide = await storage.getGuide(share.guideId);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      const steps = await storage.getStepsByGuide(share.guideId);
      
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
      const { stepTitle, actionType, context } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a technical writer for a documentation tool. Generate a clear, concise step description based on the action and context. Keep it under 2 sentences."
          },
          {
            role: "user",
            content: `Action: ${actionType}\nTitle/Element: ${stepTitle}\nContext: ${context || 'No context'}`
          }
        ],
        max_tokens: 100
      });

      const description = completion.choices[0].message.content || "Description generated.";
      res.json({ description });
    } catch (error) {
      console.error("AI Generation error:", error);
      res.status(500).json({ message: "Failed to generate description" });
    }
  });

  // AI Screenshot Analysis - analyze screenshot and generate step description
  app.post("/api/ai/analyze-screenshot", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { imageUrl, imageBase64, context } = req.body;
      
      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ message: "Either imageUrl or imageBase64 is required" });
      }

      const imageContent = imageBase64 
        ? { type: "image_url" as const, image_url: { url: `data:image/png;base64,${imageBase64}` } }
        : { type: "image_url" as const, image_url: { url: imageUrl } };

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert technical writer for a workflow documentation platform. Analyze the screenshot and provide:
1. A concise title for this step (max 10 words)
2. A clear description of what action the user should take (1-2 sentences)
3. Any UI elements that should be highlighted or called out

Format your response as JSON: { "title": "...", "description": "...", "highlights": ["..."] }`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this screenshot and describe what action the user needs to take. ${context ? `Context: ${context}` : ""}` },
              imageContent
            ]
          }
        ],
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      const analysis = content ? JSON.parse(content) : { title: "Untitled Step", description: "No description", highlights: [] };
      
      res.json(analysis);
    } catch (error) {
      console.error("AI Screenshot Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze screenshot" });
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

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert technical writer. Review this workflow guide and suggest improvements:
1. Make titles more action-oriented and clear
2. Ensure descriptions are concise but complete
3. Check for missing context or unclear steps
4. Suggest a better overall title if needed

Respond in JSON format: { "improvedTitle": "...", "steps": [{ "order": 1, "improvedTitle": "...", "improvedDescription": "..." }], "suggestions": ["..."] }`
          },
          {
            role: "user",
            content: `Guide Title: ${guide.title}\n\nSteps:\n${JSON.stringify(stepsInfo, null, 2)}`
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      const improvements = content ? JSON.parse(content) : { improvedTitle: guide.title, steps: [], suggestions: [] };
      
      res.json(improvements);
    } catch (error) {
      console.error("AI Improve Guide error:", error);
      res.status(500).json({ message: "Failed to improve guide" });
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

      const page = await storage.createContentPage({
        title,
        slug: slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        content: sanitizedContent,
        metaDescription: metaDescription || null,
        status: status || 'draft',
        showInFooter: showInFooter !== undefined ? showInFooter : true,
        footerOrder: footerOrder || 0,
        createdById: userId,
        updatedById: userId,
        publishedAt: status === 'published' ? new Date() : null,
      });

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
          guideId: guide.id,
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
    
    if (!workspaceId) {
      return res.json({
        totalViews: 0,
        totalGuides: 0,
        avgCompletionRate: 0,
        avgTimeSpent: 0,
        viewsTrend: 0,
        topGuides: [],
        recentActivity: [],
      });
    }

    try {
      const analytics = await storage.getWorkspaceAnalytics(workspaceId);
      res.json(analytics);
    } catch (err) {
      console.error("Analytics error:", err);
      res.json({
        totalViews: 0,
        totalGuides: 0,
        avgCompletionRate: 0,
        avgTimeSpent: 0,
        viewsTrend: 0,
        topGuides: [],
        recentActivity: [],
      });
    }
  });

  // === TEMPLATES API ===
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

  return httpServer;
}

// Seed function to create initial data if needed
async function seedDatabase() {
  // We can add some logic here to check if specific system data exists
  console.log("Database seeded successfully.");
}
