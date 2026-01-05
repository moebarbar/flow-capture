import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./models/auth";

// Export auth models so they are included in the schema
export * from "./models/auth";
export * from "./models/chat";

// === ENUMS ===
export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "admin", "editor", "viewer"]);
export const guideStatusEnum = pgEnum("guide_status", ["draft", "published", "archived"]);
export const stepTypeEnum = pgEnum("step_type", ["click", "input", "navigation", "wait", "scroll", "custom"]);
export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "published", "archived"]);
export const tokenTypeEnum = pgEnum("token_type", ["email_verification", "password_reset"]);

// === TABLE DEFINITIONS ===

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#000000"),
  ownerId: text("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  role: workspaceRoleEnum("role").default("viewer").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  parentId: integer("parent_id"), // For nested folders
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const guides = pgTable("guides", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  folderId: integer("folder_id").references(() => folders.id),
  title: text("title").notNull().default("Untitled Guide"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  status: guideStatusEnum("status").default("draft").notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  viewCount: integer("view_count").default(0).notNull(),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  order: integer("order").notNull(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  actionType: stepTypeEnum("action_type").default("click").notNull(),
  selector: text("selector"), // CSS selector
  url: text("url"), // Page URL where step happens
  metadata: jsonb("metadata"), // Extra data like element attributes, coordinates
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Guide sharing with password protection
export const guideShares = pgTable("guide_shares", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  shareToken: text("share_token").unique().notNull(), // Unique token for the shareable link
  passwordHash: text("password_hash"), // bcrypt hashed password (null = no password required)
  enabled: boolean("enabled").default(true).notNull(),
  accessCount: integer("access_count").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  featuredImageUrl: text("featured_image_url"),
  status: blogPostStatusEnum("status").default("draft").notNull(),
  authorId: text("author_id").references(() => users.id).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Site settings (singleton - one row for the whole site)
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  siteName: text("site_name").default("FlowCapture"),
  siteDescription: text("site_description"),
  primaryColor: text("primary_color").default("#6366f1"),
  secondaryColor: text("secondary_color").default("#8b5cf6"),
  accentColor: text("accent_color").default("#06b6d4"),
  headScripts: text("head_scripts"),
  bodyScripts: text("body_scripts"),
  customCss: text("custom_css"),
  socialLinks: jsonb("social_links"),
  // Landing page CTA links
  extensionLink: text("extension_link"),
  demoLink: text("demo_link"),
  pricingLink: text("pricing_link"),
  docsLink: text("docs_link"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const discountCodeStatusEnum = pgEnum("discount_code_status", ["active", "inactive", "expired"]);

// Auth tokens for email verification and password reset
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull(), // Hashed token for security
  tokenType: tokenTypeEnum("token_type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // null = not used, set when used
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email settings for SendGrid configuration (admin-managed)
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  sendgridApiKey: text("sendgrid_api_key"), // Encrypted in production
  fromEmail: text("from_email").default("noreply@flowcapture.com"),
  fromName: text("from_name").default("FlowCapture"),
  replyToEmail: text("reply_to_email"),
  // Email templates
  verificationSubject: text("verification_subject").default("Verify your email address"),
  verificationTemplate: text("verification_template"),
  passwordResetSubject: text("password_reset_subject").default("Reset your password"),
  passwordResetTemplate: text("password_reset_template"),
  welcomeSubject: text("welcome_subject").default("Welcome to FlowCapture!"),
  welcomeTemplate: text("welcome_template"),
  // Feature toggles
  enableEmailVerification: boolean("enable_email_verification").default(true).notNull(),
  enableWelcomeEmail: boolean("enable_welcome_email").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // 'percent' or 'fixed'
  discountValue: integer("discount_value").notNull(), // percentage (0-100) or cents
  currency: text("currency").default("usd"),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  status: discountCodeStatusEnum("status").default("active").notNull(),
  stripePromotionId: text("stripe_promotion_id"),
  stripeCouponId: text("stripe_coupon_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Guide Analytics - Track views and engagement
export const guideAnalytics = pgTable("guide_analytics", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  viewerId: text("viewer_id"), // Can be null for anonymous views
  sessionId: text("session_id"),
  completedSteps: integer("completed_steps").default(0).notNull(),
  totalSteps: integer("total_steps").default(0).notNull(),
  timeSpentSeconds: integer("time_spent_seconds").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Guide Templates - Pre-built guide templates
export const templateCategoryEnum = pgEnum("template_category", [
  "onboarding", "training", "sales", "support", "hr", "it", "marketing", "custom"
]);

export const guideTemplates = pgTable("guide_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: templateCategoryEnum("category").default("custom").notNull(),
  coverImageUrl: text("cover_image_url"),
  stepsData: jsonb("steps_data").notNull(), // JSON array of step templates
  isPublic: boolean("is_public").default(true).notNull(),
  createdById: text("created_by_id").references(() => users.id),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Guide Versions - Track changes history
export const guideVersions = pgTable("guide_versions", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  stepsSnapshot: jsonb("steps_snapshot").notNull(), // Full snapshot of steps at this version
  createdById: text("created_by_id").references(() => users.id).notNull(),
  changeNotes: text("change_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workspace Settings - Per-workspace configuration
export const workspaceSettings = pgTable("workspace_settings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  autoRedactEmails: boolean("auto_redact_emails").default(false).notNull(),
  autoRedactPasswords: boolean("auto_redact_passwords").default(true).notNull(),
  autoRedactPhones: boolean("auto_redact_phones").default(false).notNull(),
  autoRedactCustomPatterns: jsonb("auto_redact_custom_patterns"), // Array of regex patterns
  defaultLanguage: text("default_language").default("en"),
  enableAiDescriptions: boolean("enable_ai_descriptions").default(true).notNull(),
  enableAiVoiceover: boolean("enable_ai_voiceover").default(false).notNull(),
  brandColor: text("brand_color"),
  customDomain: text("custom_domain"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === SUBSCRIPTION & BILLING ===

export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "inactive", "trialing", "past_due", "canceled", "unpaid"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "declined", "expired"]);

// User subscriptions - Track user plan and Stripe subscription
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull().unique(),
  plan: text("plan").default("free").notNull(), // 'free' or 'pro'
  status: subscriptionStatusEnum("status").default("active").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeBasePriceId: text("stripe_base_price_id"), // $23/month base
  stripeSeatPriceId: text("stripe_seat_price_id"), // $7/user add-on
  seatQuantity: integer("seat_quantity").default(1).notNull(), // Number of seats (including owner)
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace invitations - Invite users to workspaces
export const workspaceInvitations = pgTable("workspace_invitations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  email: text("email").notNull(), // Email of invited user
  role: workspaceRoleEnum("role").default("editor").notNull(),
  invitedById: text("invited_by_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull(), // Hashed invitation token
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === RELATIONS ===

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
  invitedBy: one(users, {
    fields: [workspaceInvitations.invitedById],
    references: [users.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  guides: many(guides),
  folders: many(folders),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [folders.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "nested_folders",
  }),
  children: many(folders, {
    relationName: "nested_folders",
  }),
  guides: many(guides),
}));

export const guidesRelations = relations(guides, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [guides.workspaceId],
    references: [workspaces.id],
  }),
  folder: one(folders, {
    fields: [guides.folderId],
    references: [folders.id],
  }),
  author: one(users, {
    fields: [guides.createdById],
    references: [users.id],
  }),
  steps: many(steps),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  guide: one(guides, {
    fields: [steps.guideId],
    references: [guides.id],
  }),
}));

export const guideSharesRelations = relations(guideShares, ({ one }) => ({
  guide: one(guides, {
    fields: [guideShares.guideId],
    references: [guides.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertGuideSchema = createInsertSchema(guides).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  viewCount: true
});

export const insertStepSchema = createInsertSchema(steps).omit({ 
  id: true, 
  createdAt: true 
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true
});

export const insertGuideShareSchema = createInsertSchema(guideShares).omit({
  id: true,
  accessCount: true,
  lastAccessedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSiteSettingsSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({
  id: true,
  redemptionCount: true,
  createdAt: true,
  updatedAt: true
});

export const insertAuthTokenSchema = createInsertSchema(authTokens).omit({
  id: true,
  usedAt: true,
  createdAt: true
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations).omit({
  id: true,
  acceptedAt: true,
  createdAt: true
});

// === TYPES ===

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type Guide = typeof guides.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;

export type Step = typeof steps.$inferSelect;
export type InsertStep = z.infer<typeof insertStepSchema>;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type GuideShare = typeof guideShares.$inferSelect;
export type InsertGuideShare = z.infer<typeof insertGuideShareSchema>;

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;

export type DiscountCode = typeof discountCodes.$inferSelect;
export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;

export type GuideAnalytics = typeof guideAnalytics.$inferSelect;
export type InsertGuideAnalytics = typeof guideAnalytics.$inferInsert;

export type GuideTemplate = typeof guideTemplates.$inferSelect;
export type InsertGuideTemplate = typeof guideTemplates.$inferInsert;

export type GuideVersion = typeof guideVersions.$inferSelect;
export type InsertGuideVersion = typeof guideVersions.$inferInsert;

export type WorkspaceSettingsType = typeof workspaceSettings.$inferSelect;
export type InsertWorkspaceSettings = typeof workspaceSettings.$inferInsert;

export type AuthToken = typeof authTokens.$inferSelect;
export type InsertAuthToken = z.infer<typeof insertAuthTokenSchema>;

export type EmailSettingsType = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type InsertWorkspaceInvitation = z.infer<typeof insertWorkspaceInvitationSchema>;

// API Request/Response Types
export type CreateWorkspaceRequest = InsertWorkspace;
export type UpdateWorkspaceRequest = Partial<InsertWorkspace>;

export type CreateGuideRequest = InsertGuide;
export type UpdateGuideRequest = Partial<InsertGuide>;

export type CreateStepRequest = InsertStep;
export type UpdateStepRequest = Partial<InsertStep>;
export type ReorderStepsRequest = { stepIds: number[] }; // Ordered list of IDs

export type CreateFolderRequest = InsertFolder;

// Response types including relations
export type GuideWithSteps = Guide & { steps: Step[] };
export type WorkspaceWithMembers = Workspace & { members: (typeof workspaceMembers.$inferSelect & { user: typeof users.$inferSelect })[] };
