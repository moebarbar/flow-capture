import { 
  users, workspaces, workspaceMembers, guides, steps, folders, blogPosts,
  type User, type InsertUser,
  type Workspace, type InsertWorkspace,
  type Guide, type InsertGuide,
  type Step, type InsertStep,
  type Folder, type InsertFolder,
  type BlogPost, type InsertBlogPost,
  type WorkspaceWithMembers
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<User>;
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  getAdminStats(): Promise<{ totalUsers: number; totalWorkspaces: number; totalGuides: number; activeSubscriptions: number }>;

  // Workspaces
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspacesForUser(userId: string): Promise<Workspace[]>;
  updateWorkspace(id: number, workspace: Partial<InsertWorkspace>): Promise<Workspace>;
  
  // Workspace Members
  addWorkspaceMember(workspaceId: number, userId: string, role: string): Promise<void>;
  getWorkspaceMembers(workspaceId: number): Promise<WorkspaceWithMembers['members']>;

  // Guides
  createGuide(guide: InsertGuide): Promise<Guide>;
  getGuide(id: number): Promise<Guide | undefined>;
  getGuidesByWorkspace(workspaceId: number): Promise<Guide[]>;
  updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide>;
  deleteGuide(id: number): Promise<void>;

  // Steps
  createStep(step: InsertStep): Promise<Step>;
  getStepsByGuide(guideId: number): Promise<Step[]>;
  updateStep(id: number, step: Partial<InsertStep>): Promise<Step>;
  deleteStep(id: number): Promise<void>;
  reorderSteps(stepIds: number[]): Promise<void>;

  // Folders
  createFolder(folder: InsertFolder): Promise<Folder>;
  getFoldersByWorkspace(workspaceId: number): Promise<Folder[]>;

  // Blog Posts
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getAllBlogPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Replit auth doesn't use username in the same way, but we implement for interface compat
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User> {
    const [user] = await db.update(users)
      .set({ ...info, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    return db.select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalWorkspaces: number; totalGuides: number; activeSubscriptions: number }> {
    const [usersCount] = await db.select({ count: db.$count(users) }).from(users);
    const [workspacesCount] = await db.select({ count: db.$count(workspaces) }).from(workspaces);
    const [guidesCount] = await db.select({ count: db.$count(guides) }).from(guides);
    const activeSubsResult = await db.select()
      .from(users)
      .where(eq(users.subscriptionStatus, 'active'));

    return {
      totalUsers: usersCount?.count || 0,
      totalWorkspaces: workspacesCount?.count || 0,
      totalGuides: guidesCount?.count || 0,
      activeSubscriptions: activeSubsResult.length,
    };
  }

  // Workspace methods
  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [newWorkspace] = await db.insert(workspaces).values(workspace).returning();
    // Add creator as owner/admin
    await this.addWorkspaceMember(newWorkspace.id, workspace.ownerId, "owner");
    return newWorkspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    // Get workspaces where user is a member
    const memberRecords = await db.select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));
    
    if (memberRecords.length === 0) return [];

    const workspaceIds = memberRecords.map(m => m.workspaceId);
    
    // This is a simple implementation. Drizzle's `inArray` would be better but keeping it simple with loops or separate queries if needed.
    // Actually let's use a join or multiple queries.
    const results = [];
    for (const rec of memberRecords) {
      const w = await this.getWorkspace(rec.workspaceId);
      if (w) results.push(w);
    }
    return results;
  }

  async updateWorkspace(id: number, update: Partial<InsertWorkspace>): Promise<Workspace> {
    const [updated] = await db.update(workspaces)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async addWorkspaceMember(workspaceId: number, userId: string, role: string = "viewer"): Promise<void> {
    await db.insert(workspaceMembers).values({
      workspaceId,
      userId,
      role: role as any,
    });
  }

  async getWorkspaceMembers(workspaceId: number): Promise<WorkspaceWithMembers['members']> {
    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: {
        user: true
      }
    });
    return members;
  }

  // Guide methods
  async createGuide(guide: InsertGuide): Promise<Guide> {
    const [newGuide] = await db.insert(guides).values(guide).returning();
    return newGuide;
  }

  async getGuide(id: number): Promise<Guide | undefined> {
    const [guide] = await db.select().from(guides).where(eq(guides.id, id));
    return guide;
  }

  async getGuidesByWorkspace(workspaceId: number): Promise<Guide[]> {
    return db.select()
      .from(guides)
      .where(eq(guides.workspaceId, workspaceId))
      .orderBy(desc(guides.createdAt));
  }

  async updateGuide(id: number, update: Partial<InsertGuide>): Promise<Guide> {
    const [updated] = await db.update(guides)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(guides.id, id))
      .returning();
    return updated;
  }

  async deleteGuide(id: number): Promise<void> {
    // Delete steps first (cascade should handle this but let's be safe if we didn't set it up perfectly)
    await db.delete(steps).where(eq(steps.guideId, id));
    await db.delete(guides).where(eq(guides.id, id));
  }

  // Step methods
  async createStep(step: InsertStep): Promise<Step> {
    const [newStep] = await db.insert(steps).values(step).returning();
    return newStep;
  }

  async getStepsByGuide(guideId: number): Promise<Step[]> {
    return db.select()
      .from(steps)
      .where(eq(steps.guideId, guideId))
      .orderBy(asc(steps.order));
  }

  async updateStep(id: number, update: Partial<InsertStep>): Promise<Step> {
    const [updated] = await db.update(steps)
      .set(update)
      .where(eq(steps.id, id))
      .returning();
    return updated;
  }

  async deleteStep(id: number): Promise<void> {
    await db.delete(steps).where(eq(steps.id, id));
  }

  async reorderSteps(stepIds: number[]): Promise<void> {
    // This could be optimized to a single query with a CASE statement
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(steps)
        .set({ order: i })
        .where(eq(steps.id, stepIds[i]));
    }
  }

  // Folder methods
  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [newFolder] = await db.insert(folders).values(folder).returning();
    return newFolder;
  }

  async getFoldersByWorkspace(workspaceId: number): Promise<Folder[]> {
    return db.select()
      .from(folders)
      .where(eq(folders.workspaceId, workspaceId));
  }

  // Blog Post methods
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getAllBlogPosts(limit = 50, offset = 0): Promise<BlogPost[]> {
    return db.select()
      .from(blogPosts)
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateBlogPost(id: number, update: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updated] = await db.update(blogPosts)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }
}

export const storage = new DatabaseStorage();
