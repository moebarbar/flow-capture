import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { openai } from "./replit_integrations/image/client"; 

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  // === AI ===
  app.post(api.ai.generateDescription.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { stepTitle, actionType, context } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
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
        max_completion_tokens: 100
      });

      const description = completion.choices[0].message.content || "Description generated.";
      res.json({ description });
    } catch (error) {
      console.error("AI Generation error:", error);
      res.status(500).json({ message: "Failed to generate description" });
    }
  });

  return httpServer;
}

// Seed function to create initial data if needed
async function seedDatabase() {
  // We can add some logic here to check if specific system data exists
  console.log("Database seeded successfully.");
}
