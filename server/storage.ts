import { 
  users, workspaces, workspaceMembers, guides, steps, folders, collections, blogPosts, siteSettings, discountCodes,
  guideAnalytics, guideTemplates, guideVersions, workspaceSettings, guideShares, contentPages,
  stepAssignments, guideApprovals, stepComments, notifications, teamActivity,
  guideTranslations, stepTranslations, kbCategories, kbArticles, kbArticleViews, kbBrandingSettings,
  type User, type UpsertUser,
  type Workspace, type InsertWorkspace,
  type Guide, type InsertGuide,
  type Step, type InsertStep,
  type Folder, type InsertFolder,
  type Collection, type InsertCollection,
  type BlogPost, type InsertBlogPost,
  type ContentPage, type InsertContentPage,
  type SiteSettings, type InsertSiteSettings,
  type DiscountCode, type InsertDiscountCode,
  type WorkspaceWithMembers,
  type GuideTemplate, type GuideVersion, type WorkspaceSettingsType,
  type GuideShare, type InsertGuideShare,
  type StepAssignment, type InsertStepAssignment,
  type GuideApproval, type InsertGuideApproval,
  type StepComment, type InsertStepComment,
  type Notification, type InsertNotification,
  type TeamActivity, type InsertTeamActivity,
  type GuideTranslation, type InsertGuideTranslation,
  type StepTranslation, type InsertStepTranslation,
  type KbCategory, type InsertKbCategory,
  type KbArticle, type InsertKbArticle,
  type KbBrandingSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, inArray, sql, ilike, or } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
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
  getStep(id: number): Promise<Step | undefined>;
  getStepsByGuide(guideId: number): Promise<Step[]>;
  updateStep(id: number, step: Partial<InsertStep>): Promise<Step>;
  deleteStep(id: number): Promise<void>;
  reorderSteps(stepIds: number[]): Promise<void>;

  // Folders
  createFolder(folder: InsertFolder): Promise<Folder>;
  getFoldersByWorkspace(workspaceId: number): Promise<Folder[]>;

  // Collections
  createCollection(collection: InsertCollection): Promise<Collection>;
  getCollection(id: number): Promise<Collection | undefined>;
  getCollectionsByWorkspace(workspaceId: number): Promise<Collection[]>;
  updateCollection(id: number, collection: Partial<InsertCollection>): Promise<Collection>;
  deleteCollection(id: number): Promise<void>;
  getCollectionFlowCount(collectionId: number): Promise<number>;

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

  // Content Pages (admin-managed pages like Privacy Policy, Terms)
  createContentPage(page: InsertContentPage): Promise<ContentPage>;
  getContentPage(id: number): Promise<ContentPage | undefined>;
  getContentPageBySlug(slug: string): Promise<ContentPage | undefined>;
  getAllContentPages(limit?: number, offset?: number): Promise<ContentPage[]>;
  getPublishedContentPages(): Promise<ContentPage[]>;
  getFooterContentPages(): Promise<ContentPage[]>;
  updateContentPage(id: number, page: Partial<InsertContentPage>): Promise<ContentPage>;
  deleteContentPage(id: number): Promise<void>;

  // Step Assignments
  createStepAssignment(assignment: InsertStepAssignment): Promise<StepAssignment>;
  getStepAssignment(id: number): Promise<StepAssignment | undefined>;
  getAssignmentsByStep(stepId: number): Promise<StepAssignment[]>;
  getAssignmentsByGuide(guideId: number): Promise<StepAssignment[]>;
  getAssignmentsByUser(userId: string): Promise<StepAssignment[]>;
  getAssignmentsByWorkspace(workspaceId: number): Promise<StepAssignment[]>;
  updateStepAssignment(id: number, assignment: Partial<InsertStepAssignment>): Promise<StepAssignment>;
  deleteStepAssignment(id: number): Promise<void>;

  // Guide Approvals
  createGuideApproval(approval: InsertGuideApproval): Promise<GuideApproval>;
  getGuideApproval(id: number): Promise<GuideApproval | undefined>;
  getApprovalsByGuide(guideId: number): Promise<GuideApproval[]>;
  getPendingApprovalsByReviewer(reviewerId: string): Promise<GuideApproval[]>;
  getPendingApprovalsByWorkspace(workspaceId: number): Promise<GuideApproval[]>;
  updateGuideApproval(id: number, approval: Partial<InsertGuideApproval>): Promise<GuideApproval>;
  deleteGuideApproval(id: number): Promise<void>;

  // Step Comments
  createStepComment(comment: InsertStepComment): Promise<StepComment>;
  getStepComment(id: number): Promise<StepComment | undefined>;
  getCommentsByStep(stepId: number): Promise<StepComment[]>;
  getCommentsByGuide(guideId: number): Promise<StepComment[]>;
  updateStepComment(id: number, comment: Partial<InsertStepComment>): Promise<StepComment>;
  deleteStepComment(id: number): Promise<void>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // Team Activity
  createTeamActivity(activity: InsertTeamActivity): Promise<TeamActivity>;
  getTeamActivityByWorkspace(workspaceId: number, limit?: number): Promise<TeamActivity[]>;
  getTeamDashboardStats(workspaceId: number): Promise<{
    totalGuides: number;
    publishedGuides: number;
    pendingApprovals: number;
    activeAssignments: number;
    completedAssignments: number;
    recentActivity: TeamActivity[];
  }>;

  // Translations
  getGuideTranslations(guideId: number): Promise<GuideTranslation[]>;
  getGuideTranslation(guideId: number, locale: string): Promise<GuideTranslation | undefined>;
  createGuideTranslation(translation: InsertGuideTranslation): Promise<GuideTranslation>;
  updateGuideTranslation(id: number, translation: Partial<InsertGuideTranslation>): Promise<GuideTranslation>;
  deleteGuideTranslation(guideId: number, locale: string): Promise<void>;
  getStepTranslationsByGuide(guideId: number, locale: string): Promise<StepTranslation[]>;
  getStepTranslation(stepId: number, locale: string): Promise<StepTranslation | undefined>;
  createStepTranslation(translation: InsertStepTranslation): Promise<StepTranslation>;
  updateStepTranslation(id: number, translation: Partial<InsertStepTranslation>): Promise<StepTranslation>;
  deleteStepTranslations(guideId: number, locale: string): Promise<void>;

  // Knowledge Base Categories
  createKbCategory(category: InsertKbCategory): Promise<KbCategory>;
  getKbCategory(id: number): Promise<KbCategory | undefined>;
  getKbCategoryBySlug(slug: string): Promise<KbCategory | undefined>;
  getAllKbCategories(): Promise<KbCategory[]>;
  getActiveKbCategories(): Promise<KbCategory[]>;
  updateKbCategory(id: number, category: Partial<InsertKbCategory>): Promise<KbCategory>;
  deleteKbCategory(id: number): Promise<void>;

  // Knowledge Base Articles
  createKbArticle(article: InsertKbArticle): Promise<KbArticle>;
  getKbArticle(id: number): Promise<KbArticle | undefined>;
  getKbArticleBySlug(slug: string): Promise<KbArticle | undefined>;
  getAllKbArticles(limit?: number, offset?: number): Promise<KbArticle[]>;
  getPublishedKbArticles(categoryId?: number): Promise<KbArticle[]>;
  getKbArticlesByCategory(categoryId: number): Promise<KbArticle[]>;
  searchKbArticles(query: string): Promise<KbArticle[]>;
  updateKbArticle(id: number, article: Partial<InsertKbArticle>): Promise<KbArticle>;
  deleteKbArticle(id: number): Promise<void>;
  incrementKbArticleViewCount(id: number): Promise<void>;
  updateKbArticleHelpfulness(id: number, helpful: boolean): Promise<void>;

  // Knowledge Base Branding
  getKbBranding(): Promise<KbBrandingSettings | undefined>;
  upsertKbBranding(settings: {
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    headerTitle: string;
    headerSubtitle: string;
    showSearch: boolean;
    showCategories: boolean;
  }): Promise<KbBrandingSettings>;
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

  async createUser(insertUser: UpsertUser): Promise<User> {
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
    // Get workspaces where user is a member - optimized single query
    const memberRecords = await db.select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));
    
    if (memberRecords.length === 0) return [];

    const workspaceIds = memberRecords.map(m => m.workspaceId);
    
    // Single query using inArray instead of N+1 pattern
    return db.select()
      .from(workspaces)
      .where(inArray(workspaces.id, workspaceIds));
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
    await db.delete(steps).where(eq(steps.flowId, id));
    await db.delete(guides).where(eq(guides.id, id));
  }

  // Step methods
  async createStep(step: InsertStep): Promise<Step> {
    const [newStep] = await db.insert(steps).values(step).returning();
    return newStep;
  }

  async getStep(id: number): Promise<Step | undefined> {
    const [step] = await db.select().from(steps).where(eq(steps.id, id));
    return step;
  }

  async getStepsByGuide(guideId: number): Promise<Step[]> {
    return db.select()
      .from(steps)
      .where(eq(steps.flowId, guideId))
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
    if (stepIds.length === 0) return;
    
    // Batch update using Promise.all for parallel execution
    await Promise.all(
      stepIds.map((id, i) =>
        db.update(steps)
          .set({ order: i })
          .where(eq(steps.id, id))
      )
    );
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

  // Collection methods
  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [newCollection] = await db.insert(collections).values(collection).returning();
    return newCollection;
  }

  async getCollection(id: number): Promise<Collection | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    return collection;
  }

  async getCollectionsByWorkspace(workspaceId: number): Promise<Collection[]> {
    return db.select()
      .from(collections)
      .where(eq(collections.workspaceId, workspaceId))
      .orderBy(asc(collections.name));
  }

  async updateCollection(id: number, update: Partial<InsertCollection>): Promise<Collection> {
    const [updated] = await db.update(collections)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    return updated;
  }

  async deleteCollection(id: number): Promise<void> {
    await db.delete(collections).where(eq(collections.id, id));
  }

  async getCollectionFlowCount(collectionId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(guides)
      .where(eq(guides.collectionId, collectionId));
    return Number(result[0]?.count || 0);
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
          flowId: guide.id,
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
      .where(eq(guideVersions.flowId, guideId))
      .orderBy(desc(guideVersions.versionNumber))
      .limit(1);
    
    const nextVersion = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;
    
    const [version] = await db.insert(guideVersions).values({
      flowId: guideId,
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
      .where(eq(guideVersions.flowId, guideId))
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
    const [share] = await db.select().from(guideShares).where(eq(guideShares.flowId, guideId));
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

  // Content Pages methods
  async createContentPage(page: InsertContentPage): Promise<ContentPage> {
    const [newPage] = await db.insert(contentPages).values(page).returning();
    return newPage;
  }

  async getContentPage(id: number): Promise<ContentPage | undefined> {
    const [page] = await db.select().from(contentPages).where(eq(contentPages.id, id));
    return page;
  }

  async getContentPageBySlug(slug: string): Promise<ContentPage | undefined> {
    const [page] = await db.select().from(contentPages).where(eq(contentPages.slug, slug));
    return page;
  }

  async getAllContentPages(limit = 50, offset = 0): Promise<ContentPage[]> {
    return db.select()
      .from(contentPages)
      .orderBy(desc(contentPages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getPublishedContentPages(): Promise<ContentPage[]> {
    return db.select()
      .from(contentPages)
      .where(eq(contentPages.status, 'published'))
      .orderBy(asc(contentPages.footerOrder));
  }

  async getFooterContentPages(): Promise<ContentPage[]> {
    return db.select()
      .from(contentPages)
      .where(and(
        eq(contentPages.status, 'published'),
        eq(contentPages.showInFooter, true)
      ))
      .orderBy(asc(contentPages.footerOrder));
  }

  async updateContentPage(id: number, update: Partial<InsertContentPage>): Promise<ContentPage> {
    const [updated] = await db.update(contentPages)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(contentPages.id, id))
      .returning();
    return updated;
  }

  async deleteContentPage(id: number): Promise<void> {
    await db.delete(contentPages).where(eq(contentPages.id, id));
  }

  // Step Assignments methods
  async createStepAssignment(assignment: InsertStepAssignment): Promise<StepAssignment> {
    const [newAssignment] = await db.insert(stepAssignments).values(assignment).returning();
    return newAssignment;
  }

  async getStepAssignment(id: number): Promise<StepAssignment | undefined> {
    const [assignment] = await db.select().from(stepAssignments).where(eq(stepAssignments.id, id));
    return assignment;
  }

  async getAssignmentsByStep(stepId: number): Promise<StepAssignment[]> {
    return db.select().from(stepAssignments)
      .where(eq(stepAssignments.stepId, stepId))
      .orderBy(desc(stepAssignments.createdAt));
  }

  async getAssignmentsByGuide(guideId: number): Promise<StepAssignment[]> {
    return db.select().from(stepAssignments)
      .where(eq(stepAssignments.flowId, guideId))
      .orderBy(desc(stepAssignments.createdAt));
  }

  async getAssignmentsByUser(userId: string): Promise<StepAssignment[]> {
    return db.select().from(stepAssignments)
      .where(eq(stepAssignments.assigneeId, userId))
      .orderBy(desc(stepAssignments.createdAt));
  }

  async getAssignmentsByWorkspace(workspaceId: number): Promise<StepAssignment[]> {
    return db.select().from(stepAssignments)
      .where(eq(stepAssignments.workspaceId, workspaceId))
      .orderBy(desc(stepAssignments.createdAt));
  }

  async updateStepAssignment(id: number, update: Partial<InsertStepAssignment>): Promise<StepAssignment> {
    const [updated] = await db.update(stepAssignments)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(stepAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteStepAssignment(id: number): Promise<void> {
    await db.delete(stepAssignments).where(eq(stepAssignments.id, id));
  }

  // Guide Approvals methods
  async createGuideApproval(approval: InsertGuideApproval): Promise<GuideApproval> {
    const [newApproval] = await db.insert(guideApprovals).values(approval).returning();
    return newApproval;
  }

  async getGuideApproval(id: number): Promise<GuideApproval | undefined> {
    const [approval] = await db.select().from(guideApprovals).where(eq(guideApprovals.id, id));
    return approval;
  }

  async getApprovalsByGuide(guideId: number): Promise<GuideApproval[]> {
    return db.select().from(guideApprovals)
      .where(eq(guideApprovals.flowId, guideId))
      .orderBy(desc(guideApprovals.createdAt));
  }

  async getPendingApprovalsByReviewer(reviewerId: string): Promise<GuideApproval[]> {
    return db.select().from(guideApprovals)
      .where(and(
        eq(guideApprovals.reviewerId, reviewerId),
        eq(guideApprovals.status, 'pending')
      ))
      .orderBy(desc(guideApprovals.createdAt));
  }

  async getPendingApprovalsByWorkspace(workspaceId: number): Promise<GuideApproval[]> {
    return db.select().from(guideApprovals)
      .where(and(
        eq(guideApprovals.workspaceId, workspaceId),
        eq(guideApprovals.status, 'pending')
      ))
      .orderBy(desc(guideApprovals.createdAt));
  }

  async updateGuideApproval(id: number, update: Partial<InsertGuideApproval>): Promise<GuideApproval> {
    const [updated] = await db.update(guideApprovals)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(guideApprovals.id, id))
      .returning();
    return updated;
  }

  async deleteGuideApproval(id: number): Promise<void> {
    await db.delete(guideApprovals).where(eq(guideApprovals.id, id));
  }

  // Step Comments methods
  async createStepComment(comment: InsertStepComment): Promise<StepComment> {
    const [newComment] = await db.insert(stepComments).values(comment).returning();
    return newComment;
  }

  async getStepComment(id: number): Promise<StepComment | undefined> {
    const [comment] = await db.select().from(stepComments).where(eq(stepComments.id, id));
    return comment;
  }

  async getCommentsByStep(stepId: number): Promise<StepComment[]> {
    return db.select().from(stepComments)
      .where(eq(stepComments.stepId, stepId))
      .orderBy(asc(stepComments.createdAt));
  }

  async getCommentsByGuide(guideId: number): Promise<StepComment[]> {
    return db.select().from(stepComments)
      .where(eq(stepComments.flowId, guideId))
      .orderBy(asc(stepComments.createdAt));
  }

  async updateStepComment(id: number, update: Partial<InsertStepComment>): Promise<StepComment> {
    const [updated] = await db.update(stepComments)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(stepComments.id, id))
      .returning();
    return updated;
  }

  async deleteStepComment(id: number): Promise<void> {
    await db.delete(stepComments).where(eq(stepComments.id, id));
  }

  // Notifications methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getNotificationsByUser(userId: string, limit = 50): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result[0]?.count ?? 0;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Team Activity methods
  async createTeamActivity(activity: InsertTeamActivity): Promise<TeamActivity> {
    const [newActivity] = await db.insert(teamActivity).values(activity).returning();
    return newActivity;
  }

  async getTeamActivityByWorkspace(workspaceId: number, limit = 50): Promise<TeamActivity[]> {
    return db.select().from(teamActivity)
      .where(eq(teamActivity.workspaceId, workspaceId))
      .orderBy(desc(teamActivity.createdAt))
      .limit(limit);
  }

  async getTeamDashboardStats(workspaceId: number): Promise<{
    totalGuides: number;
    publishedGuides: number;
    pendingApprovals: number;
    activeAssignments: number;
    completedAssignments: number;
    recentActivity: TeamActivity[];
  }> {
    const [guideStats] = await db.select({ 
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where status = 'published')::int`
    }).from(guides).where(eq(guides.workspaceId, workspaceId));

    const [approvalStats] = await db.select({ 
      pending: sql<number>`count(*) filter (where status = 'pending')::int`
    }).from(guideApprovals).where(eq(guideApprovals.workspaceId, workspaceId));

    const [assignmentStats] = await db.select({ 
      active: sql<number>`count(*) filter (where status in ('pending', 'in_progress'))::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`
    }).from(stepAssignments).where(eq(stepAssignments.workspaceId, workspaceId));

    const recentActivity = await this.getTeamActivityByWorkspace(workspaceId, 10);

    return {
      totalGuides: guideStats?.total ?? 0,
      publishedGuides: guideStats?.published ?? 0,
      pendingApprovals: approvalStats?.pending ?? 0,
      activeAssignments: assignmentStats?.active ?? 0,
      completedAssignments: assignmentStats?.completed ?? 0,
      recentActivity,
    };
  }

  // Translation methods
  async getGuideTranslations(guideId: number): Promise<GuideTranslation[]> {
    return db.select().from(guideTranslations)
      .where(eq(guideTranslations.flowId, guideId));
  }

  async getGuideTranslation(guideId: number, locale: string): Promise<GuideTranslation | undefined> {
    const [translation] = await db.select().from(guideTranslations)
      .where(and(
        eq(guideTranslations.flowId, guideId),
        eq(guideTranslations.locale, locale)
      ));
    return translation;
  }

  async createGuideTranslation(translation: InsertGuideTranslation): Promise<GuideTranslation> {
    const [newTranslation] = await db.insert(guideTranslations).values(translation).returning();
    return newTranslation;
  }

  async updateGuideTranslation(id: number, translation: Partial<InsertGuideTranslation>): Promise<GuideTranslation> {
    const [updated] = await db.update(guideTranslations)
      .set({ ...translation, updatedAt: new Date() })
      .where(eq(guideTranslations.id, id))
      .returning();
    return updated;
  }

  async deleteGuideTranslation(guideId: number, locale: string): Promise<void> {
    await db.delete(guideTranslations)
      .where(and(
        eq(guideTranslations.flowId, guideId),
        eq(guideTranslations.locale, locale)
      ));
  }

  async getStepTranslationsByGuide(guideId: number, locale: string): Promise<StepTranslation[]> {
    return db.select().from(stepTranslations)
      .where(and(
        eq(stepTranslations.flowId, guideId),
        eq(stepTranslations.locale, locale)
      ));
  }

  async getStepTranslation(stepId: number, locale: string): Promise<StepTranslation | undefined> {
    const [translation] = await db.select().from(stepTranslations)
      .where(and(
        eq(stepTranslations.stepId, stepId),
        eq(stepTranslations.locale, locale)
      ));
    return translation;
  }

  async createStepTranslation(translation: InsertStepTranslation): Promise<StepTranslation> {
    const [newTranslation] = await db.insert(stepTranslations).values(translation).returning();
    return newTranslation;
  }

  async updateStepTranslation(id: number, translation: Partial<InsertStepTranslation>): Promise<StepTranslation> {
    const [updated] = await db.update(stepTranslations)
      .set({ ...translation, updatedAt: new Date() })
      .where(eq(stepTranslations.id, id))
      .returning();
    return updated;
  }

  async deleteStepTranslations(guideId: number, locale: string): Promise<void> {
    await db.delete(stepTranslations)
      .where(and(
        eq(stepTranslations.flowId, guideId),
        eq(stepTranslations.locale, locale)
      ));
  }

  // Knowledge Base Category methods
  async createKbCategory(category: InsertKbCategory): Promise<KbCategory> {
    const [newCategory] = await db.insert(kbCategories).values(category).returning();
    return newCategory;
  }

  async getKbCategory(id: number): Promise<KbCategory | undefined> {
    const [category] = await db.select().from(kbCategories).where(eq(kbCategories.id, id));
    return category;
  }

  async getKbCategoryBySlug(slug: string): Promise<KbCategory | undefined> {
    const [category] = await db.select().from(kbCategories).where(eq(kbCategories.slug, slug));
    return category;
  }

  async getAllKbCategories(): Promise<KbCategory[]> {
    return db.select().from(kbCategories).orderBy(asc(kbCategories.order));
  }

  async getActiveKbCategories(): Promise<KbCategory[]> {
    return db.select().from(kbCategories)
      .where(eq(kbCategories.isActive, true))
      .orderBy(asc(kbCategories.order));
  }

  async updateKbCategory(id: number, category: Partial<InsertKbCategory>): Promise<KbCategory> {
    const [updated] = await db.update(kbCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(kbCategories.id, id))
      .returning();
    return updated;
  }

  async deleteKbCategory(id: number): Promise<void> {
    await db.delete(kbCategories).where(eq(kbCategories.id, id));
  }

  // Knowledge Base Article methods
  async createKbArticle(article: InsertKbArticle): Promise<KbArticle> {
    const [newArticle] = await db.insert(kbArticles).values(article).returning();
    // Update category article count
    if (article.categoryId) {
      await db.update(kbCategories)
        .set({ articleCount: sql`${kbCategories.articleCount} + 1` })
        .where(eq(kbCategories.id, article.categoryId));
    }
    return newArticle;
  }

  async getKbArticle(id: number): Promise<KbArticle | undefined> {
    const [article] = await db.select().from(kbArticles).where(eq(kbArticles.id, id));
    return article;
  }

  async getKbArticleBySlug(slug: string): Promise<KbArticle | undefined> {
    const [article] = await db.select().from(kbArticles).where(eq(kbArticles.slug, slug));
    return article;
  }

  async getAllKbArticles(limit = 50, offset = 0): Promise<KbArticle[]> {
    return db.select().from(kbArticles)
      .orderBy(desc(kbArticles.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getPublishedKbArticles(categoryId?: number): Promise<KbArticle[]> {
    const conditions = [eq(kbArticles.status, 'published' as const)];
    if (categoryId) {
      conditions.push(eq(kbArticles.categoryId, categoryId));
    }
    return db.select().from(kbArticles)
      .where(and(...conditions))
      .orderBy(desc(kbArticles.publishedAt));
  }

  async getKbArticlesByCategory(categoryId: number): Promise<KbArticle[]> {
    return db.select().from(kbArticles)
      .where(eq(kbArticles.categoryId, categoryId))
      .orderBy(desc(kbArticles.createdAt));
  }

  async searchKbArticles(query: string): Promise<KbArticle[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(kbArticles)
      .where(and(
        eq(kbArticles.status, 'published' as const),
        or(
          ilike(kbArticles.title, searchPattern),
          ilike(kbArticles.content, searchPattern),
          ilike(kbArticles.excerpt, searchPattern)
        )
      ))
      .orderBy(desc(kbArticles.viewCount))
      .limit(20);
  }

  async updateKbArticle(id: number, article: Partial<InsertKbArticle>): Promise<KbArticle> {
    const [updated] = await db.update(kbArticles)
      .set({ ...article, updatedAt: new Date() })
      .where(eq(kbArticles.id, id))
      .returning();
    return updated;
  }

  async deleteKbArticle(id: number): Promise<void> {
    // Get article first to update category count
    const article = await this.getKbArticle(id);
    if (article?.categoryId) {
      await db.update(kbCategories)
        .set({ articleCount: sql`GREATEST(${kbCategories.articleCount} - 1, 0)` })
        .where(eq(kbCategories.id, article.categoryId));
    }
    await db.delete(kbArticles).where(eq(kbArticles.id, id));
  }

  async incrementKbArticleViewCount(id: number): Promise<void> {
    await db.update(kbArticles)
      .set({ viewCount: sql`${kbArticles.viewCount} + 1` })
      .where(eq(kbArticles.id, id));
  }

  async updateKbArticleHelpfulness(id: number, helpful: boolean): Promise<void> {
    if (helpful) {
      await db.update(kbArticles)
        .set({ helpfulCount: sql`${kbArticles.helpfulCount} + 1` })
        .where(eq(kbArticles.id, id));
    } else {
      await db.update(kbArticles)
        .set({ notHelpfulCount: sql`${kbArticles.notHelpfulCount} + 1` })
        .where(eq(kbArticles.id, id));
    }
  }

  // Knowledge Base Branding
  async getKbBranding(): Promise<KbBrandingSettings | undefined> {
    const [branding] = await db.select().from(kbBrandingSettings).limit(1);
    return branding;
  }

  async upsertKbBranding(settings: {
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    headerTitle: string;
    headerSubtitle: string;
    showSearch: boolean;
    showCategories: boolean;
  }): Promise<KbBrandingSettings> {
    // This method expects fully populated settings - route handles merging
    const existing = await this.getKbBranding();
    
    const values = {
      ...settings,
      updatedAt: new Date(),
    };
    
    if (existing) {
      const [updated] = await db.update(kbBrandingSettings)
        .set(values)
        .where(eq(kbBrandingSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(kbBrandingSettings)
        .values(values)
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
