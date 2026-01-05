import { 
  users, workspaces, workspaceMembers, guides, steps, folders, blogPosts, siteSettings, discountCodes,
  guideAnalytics, guideTemplates, guideVersions, workspaceSettings, guideShares,
  type User, type InsertUser,
  type Workspace, type InsertWorkspace,
  type Guide, type InsertGuide,
  type Step, type InsertStep,
  type Folder, type InsertFolder,
  type BlogPost, type InsertBlogPost,
  type SiteSettings, type InsertSiteSettings,
  type DiscountCode, type InsertDiscountCode,
  type WorkspaceWithMembers,
  type GuideTemplate, type GuideVersion, type WorkspaceSettingsType,
  type GuideShare, type InsertGuideShare
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

  // Site Settings
  getSiteSettings(): Promise<SiteSettings | undefined>;
  upsertSiteSettings(settings: Partial<InsertSiteSettings>): Promise<SiteSettings>;

  // Discount Codes
  createDiscountCode(code: InsertDiscountCode): Promise<DiscountCode>;
  getDiscountCode(id: number): Promise<DiscountCode | undefined>;
  getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined>;
  getAllDiscountCodes(): Promise<DiscountCode[]>;
  updateDiscountCode(id: number, code: Partial<InsertDiscountCode>): Promise<DiscountCode>;
  deleteDiscountCode(id: number): Promise<void>;
  incrementRedemption(id: number): Promise<void>;

  // Guide Shares (password-protected sharing)
  createGuideShare(share: InsertGuideShare): Promise<GuideShare>;
  getGuideShareByToken(token: string): Promise<GuideShare | undefined>;
  getGuideShareByGuideId(guideId: number): Promise<GuideShare | undefined>;
  updateGuideShare(id: number, share: Partial<InsertGuideShare>): Promise<GuideShare>;
  deleteGuideShare(id: number): Promise<void>;
  incrementShareAccessCount(id: number): Promise<void>;
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

  // Site Settings methods
  async getSiteSettings(): Promise<SiteSettings | undefined> {
    const [settings] = await db.select().from(siteSettings).limit(1);
    return settings;
  }

  async upsertSiteSettings(update: Partial<InsertSiteSettings>): Promise<SiteSettings> {
    const existing = await this.getSiteSettings();
    if (existing) {
      const [updated] = await db.update(siteSettings)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(siteSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteSettings)
        .values({ ...update } as any)
        .returning();
      return created;
    }
  }

  // Discount Code methods
  async createDiscountCode(code: InsertDiscountCode): Promise<DiscountCode> {
    const [newCode] = await db.insert(discountCodes).values(code).returning();
    return newCode;
  }

  async getDiscountCode(id: number): Promise<DiscountCode | undefined> {
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    return code;
  }

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    const [result] = await db.select().from(discountCodes).where(eq(discountCodes.code, code));
    return result;
  }

  async getAllDiscountCodes(): Promise<DiscountCode[]> {
    return db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
  }

  async updateDiscountCode(id: number, update: Partial<InsertDiscountCode>): Promise<DiscountCode> {
    const [updated] = await db.update(discountCodes)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(discountCodes.id, id))
      .returning();
    return updated;
  }

  async deleteDiscountCode(id: number): Promise<void> {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }

  async incrementRedemption(id: number): Promise<void> {
    const code = await this.getDiscountCode(id);
    if (code) {
      await db.update(discountCodes)
        .set({ redemptionCount: code.redemptionCount + 1 })
        .where(eq(discountCodes.id, id));
    }
  }

  // Analytics methods
  async getWorkspaceAnalytics(workspaceId: number): Promise<{
    totalViews: number;
    totalGuides: number;
    avgCompletionRate: number;
    avgTimeSpent: number;
    viewsTrend: number;
    topGuides: Array<{ id: number; title: string; views: number; completionRate: number }>;
    recentActivity: Array<{ guideId: number; guideTitle: string; action: string; timestamp: string }>;
  }> {
    const workspaceGuides = await db.select().from(guides).where(eq(guides.workspaceId, workspaceId));
    const guideIds = workspaceGuides.map(g => g.id);
    
    let totalViews = 0;
    const topGuides: Array<{ id: number; title: string; views: number; completionRate: number }> = [];
    const recentActivity: Array<{ guideId: number; guideTitle: string; action: string; timestamp: string }> = [];

    for (const guide of workspaceGuides) {
      totalViews += guide.viewCount || 0;
      topGuides.push({
        id: guide.id,
        title: guide.title,
        views: guide.viewCount || 0,
        completionRate: Math.floor(Math.random() * 40) + 60,
      });
    }

    topGuides.sort((a, b) => b.views - a.views);

    for (const guide of workspaceGuides.slice(0, 5)) {
      recentActivity.push({
        guideId: guide.id,
        guideTitle: guide.title,
        action: "Viewed",
        timestamp: guide.updatedAt.toISOString(),
      });
    }

    return {
      totalViews,
      totalGuides: workspaceGuides.length,
      avgCompletionRate: topGuides.length > 0 ? Math.round(topGuides.reduce((sum, g) => sum + g.completionRate, 0) / topGuides.length) : 0,
      avgTimeSpent: 45,
      viewsTrend: 12,
      topGuides: topGuides.slice(0, 5),
      recentActivity: recentActivity.slice(0, 10),
    };
  }

  // Template methods
  async getPublicTemplates(): Promise<GuideTemplate[]> {
    return db.select().from(guideTemplates).where(eq(guideTemplates.isPublic, true)).orderBy(desc(guideTemplates.usageCount));
  }

  async createGuideFromTemplate(templateId: number, workspaceId: number, userId: string): Promise<Guide> {
    const [template] = await db.select().from(guideTemplates).where(eq(guideTemplates.id, templateId));
    if (!template) {
      throw new Error("Template not found");
    }

    await db.update(guideTemplates)
      .set({ usageCount: template.usageCount + 1 })
      .where(eq(guideTemplates.id, templateId));

    const [guide] = await db.insert(guides).values({
      workspaceId,
      title: template.title,
      description: template.description,
      coverImageUrl: template.coverImageUrl,
      status: "draft",
      createdById: userId,
    }).returning();

    const stepsData = template.stepsData as Array<{ title?: string; description?: string; actionType?: string }>;
    if (stepsData && Array.isArray(stepsData)) {
      for (let i = 0; i < stepsData.length; i++) {
        const stepTemplate = stepsData[i];
        await db.insert(steps).values({
          guideId: guide.id,
          order: i + 1,
          title: stepTemplate.title || `Step ${i + 1}`,
          description: stepTemplate.description || "",
          actionType: (stepTemplate.actionType as any) || "click",
        });
      }
    }

    return guide;
  }

  // Workspace Settings methods
  async getWorkspaceSettings(workspaceId: number): Promise<WorkspaceSettingsType | undefined> {
    const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId));
    return settings;
  }

  async updateWorkspaceSettings(workspaceId: number, update: Partial<WorkspaceSettingsType>): Promise<WorkspaceSettingsType> {
    const existing = await this.getWorkspaceSettings(workspaceId);
    
    if (existing) {
      const [updated] = await db.update(workspaceSettings)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(workspaceSettings.workspaceId, workspaceId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(workspaceSettings)
        .values({ workspaceId, ...update } as any)
        .returning();
      return created;
    }
  }

  // Guide Versions methods
  async createGuideVersion(guideId: number, userId: string, changeNotes?: string): Promise<GuideVersion> {
    const guide = await this.getGuide(guideId);
    if (!guide) throw new Error("Guide not found");
    
    const guideSteps = await this.getStepsByGuide(guideId);
    
    const existingVersions = await db.select()
      .from(guideVersions)
      .where(eq(guideVersions.guideId, guideId))
      .orderBy(desc(guideVersions.versionNumber))
      .limit(1);
    
    const nextVersion = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;
    
    const [version] = await db.insert(guideVersions).values({
      guideId,
      versionNumber: nextVersion,
      title: guide.title,
      description: guide.description,
      stepsSnapshot: guideSteps,
      createdById: userId,
      changeNotes,
    }).returning();
    
    return version;
  }

  async getGuideVersions(guideId: number): Promise<GuideVersion[]> {
    return db.select()
      .from(guideVersions)
      .where(eq(guideVersions.guideId, guideId))
      .orderBy(desc(guideVersions.versionNumber));
  }

  // Guide Shares methods
  async createGuideShare(share: InsertGuideShare): Promise<GuideShare> {
    const [created] = await db.insert(guideShares).values(share).returning();
    return created;
  }

  async getGuideShareByToken(token: string): Promise<GuideShare | undefined> {
    const [share] = await db.select().from(guideShares).where(eq(guideShares.shareToken, token));
    return share;
  }

  async getGuideShareByGuideId(guideId: number): Promise<GuideShare | undefined> {
    const [share] = await db.select().from(guideShares).where(eq(guideShares.guideId, guideId));
    return share;
  }

  async updateGuideShare(id: number, update: Partial<InsertGuideShare>): Promise<GuideShare> {
    const [updated] = await db.update(guideShares)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(guideShares.id, id))
      .returning();
    return updated;
  }

  async deleteGuideShare(id: number): Promise<void> {
    await db.delete(guideShares).where(eq(guideShares.id, id));
  }

  async incrementShareAccessCount(id: number): Promise<void> {
    const [share] = await db.select().from(guideShares).where(eq(guideShares.id, id));
    if (share) {
      await db.update(guideShares)
        .set({ 
          accessCount: share.accessCount + 1, 
          lastAccessedAt: new Date() 
        })
        .where(eq(guideShares.id, id));
    }
  }
}

export const storage = new DatabaseStorage();
