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
export const contentPageStatusEnum = pgEnum("content_page_status", ["draft", "published"]);
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

// Content pages (Privacy Policy, Terms, etc. - admin managed)
export const contentPages = pgTable("content_pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  content: text("content").notNull(),
  metaDescription: text("meta_description"),
  status: contentPageStatusEnum("status").default("draft").notNull(),
  showInFooter: boolean("show_in_footer").default(true).notNull(),
  footerOrder: integer("footer_order").default(0).notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  updatedById: text("updated_by_id").references(() => users.id),
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
  enabledLanguages: text("enabled_languages").array().default(["en"]), // Languages for auto-translation
  enableAiDescriptions: boolean("enable_ai_descriptions").default(true).notNull(),
  enableAiTranslations: boolean("enable_ai_translations").default(true).notNull(),
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

// === COLLABORATION & TEAM MANAGEMENT ===

export const assignmentStatusEnum = pgEnum("assignment_status", ["pending", "in_progress", "completed", "overdue"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "revision_requested"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "assignment_created", "assignment_updated", "assignment_completed",
  "approval_requested", "approval_approved", "approval_rejected", "approval_revision",
  "comment_added", "comment_reply", "comment_mention",
  "workspace_invitation", "guide_shared"
]);

// Step Assignments - Assign specific steps to team members
export const stepAssignments = pgTable("step_assignments", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => steps.id).notNull(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  assigneeId: text("assignee_id").references(() => users.id).notNull(),
  assignedById: text("assigned_by_id").references(() => users.id).notNull(),
  status: assignmentStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Guide Approvals - Approval workflow for guides
export const guideApprovals = pgTable("guide_approvals", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  requestedById: text("requested_by_id").references(() => users.id).notNull(),
  reviewerId: text("reviewer_id").references(() => users.id), // Assigned reviewer (manager/admin)
  status: approvalStatusEnum("status").default("pending").notNull(),
  requestNotes: text("request_notes"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Step Comments - Comments and annotations on steps
export const stepComments = pgTable("step_comments", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => steps.id).notNull(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  authorId: text("author_id").references(() => users.id).notNull(),
  parentId: integer("parent_id"), // For threaded replies
  content: text("content").notNull(),
  isEditProposal: boolean("is_edit_proposal").default(false).notNull(), // Proposed edit vs regular comment
  proposedContent: jsonb("proposed_content"), // For edit proposals: { title?, description? }
  proposalStatus: text("proposal_status"), // 'pending', 'accepted', 'rejected'
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications - User notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  guideId: integer("guide_id").references(() => guides.id),
  stepId: integer("step_id").references(() => steps.id),
  referenceId: integer("reference_id"), // Generic reference (comment ID, assignment ID, etc.)
  actorId: text("actor_id").references(() => users.id), // Who triggered the notification
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team Activity Log - Track team actions for dashboard
export const teamActivity = pgTable("team_activity", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  actionType: text("action_type").notNull(), // 'guide_created', 'step_completed', 'comment_added', etc.
  resourceType: text("resource_type").notNull(), // 'guide', 'step', 'assignment', 'approval', 'comment'
  resourceId: integer("resource_id").notNull(),
  metadata: jsonb("metadata"), // Additional action details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === TRANSLATIONS ===

export const translationStatusEnum = pgEnum("translation_status", ["pending", "processing", "completed", "failed"]);

// Supported language list - ISO 639-1 codes
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
] as const;

// Guide translations - Store translated guide title/description per locale
export const guideTranslations = pgTable("guide_translations", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  locale: text("locale").notNull(), // e.g., 'es', 'fr', 'de'
  title: text("title").notNull(),
  description: text("description"),
  status: translationStatusEnum("status").default("pending").notNull(),
  translatedAt: timestamp("translated_at"),
  sourceHash: text("source_hash"), // Hash of source content for change detection
  aiModel: text("ai_model"), // Model used for translation (e.g., 'gpt-4o')
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Step translations - Store translated step title/description per locale
export const stepTranslations = pgTable("step_translations", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => steps.id).notNull(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  locale: text("locale").notNull(), // e.g., 'es', 'fr', 'de'
  title: text("title"),
  description: text("description"),
  status: translationStatusEnum("status").default("pending").notNull(),
  translatedAt: timestamp("translated_at"),
  sourceHash: text("source_hash"), // Hash of source content for change detection
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === VOICEOVER & AUDIO ===

export const voiceoverStatusEnum = pgEnum("voiceover_status", ["pending", "processing", "completed", "failed"]);

// Step voiceovers - Store generated audio for steps
export const stepVoiceovers = pgTable("step_voiceovers", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => steps.id).notNull(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  locale: text("locale").default("en").notNull(),
  voice: text("voice").default("alloy").notNull(), // OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
  audioUrl: text("audio_url"), // URL to generated audio file
  duration: integer("duration"), // Duration in seconds
  status: voiceoverStatusEnum("status").default("pending").notNull(),
  sourceText: text("source_text"), // Text used for generation
  sourceHash: text("source_hash"), // Hash for change detection
  errorMessage: text("error_message"),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === REDACTION ===

// Redaction regions - Store detected/manual redaction regions on screenshots
export const redactionRegions = pgTable("redaction_regions", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => steps.id).notNull(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  x: integer("x").notNull(), // X position as percentage (0-100)
  y: integer("y").notNull(), // Y position as percentage (0-100)
  width: integer("width").notNull(), // Width as percentage (0-100)
  height: integer("height").notNull(), // Height as percentage (0-100)
  type: text("type").default("blur").notNull(), // blur, box, pixelate
  detectedType: text("detected_type"), // email, password, phone, custom, manual
  isAutoDetected: boolean("is_auto_detected").default(false).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === CAPTURE SESSIONS ===

export const captureStatusEnum = pgEnum("capture_status", ["active", "stopped", "expired"]);

// Capture sessions - Track active recording sessions for guides
export const captureSessions = pgTable("capture_sessions", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").references(() => guides.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  token: text("token").unique().notNull(), // Unique session token for extension auth
  status: captureStatusEnum("status").default("active").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  stoppedAt: timestamp("stopped_at"),
  eventsReceived: integer("events_received").default(0).notNull(),
  lastEventAt: timestamp("last_event_at"),
  expiresAt: timestamp("expires_at").notNull(), // Sessions expire after inactivity
});

// === INTEGRATIONS & AUTOMATION ===

export const integrationProviderEnum = pgEnum("integration_provider", [
  "slack", "microsoft_teams", "email", "jira", "clickup", "monday",
  "notion", "confluence", "google_drive", "dropbox",
  "zapier", "make", "webhook", "google_analytics", "mixpanel", "amplitude"
]);

export const integrationStatusEnum = pgEnum("integration_status", ["active", "inactive", "error"]);

export const automationTriggerEnum = pgEnum("automation_trigger", [
  "guide_created", "guide_published", "guide_completed", "guide_viewed",
  "step_completed", "step_assigned", "assignment_overdue",
  "approval_requested", "approval_approved", "approval_rejected",
  "comment_added", "user_invited", "user_joined"
]);

export const automationActionEnum = pgEnum("automation_action", [
  "send_email", "send_slack", "send_teams", "create_jira_task",
  "trigger_webhook", "assign_guide", "notify_user", "update_field"
]);

// Integration configurations per workspace
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  provider: integrationProviderEnum("provider").notNull(),
  name: text("name").notNull(),
  status: integrationStatusEnum("status").default("inactive").notNull(),
  credentials: jsonb("credentials"), // Encrypted API keys, tokens, etc.
  settings: jsonb("settings"), // Provider-specific settings
  lastSyncAt: timestamp("last_sync_at"),
  errorMessage: text("error_message"),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhooks - Outgoing webhook configurations
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"), // HMAC secret for signing
  events: text("events").array().notNull(), // Array of trigger events
  headers: jsonb("headers"), // Custom headers to send
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failureCount: integer("failure_count").default(0).notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Automations - Workflow automation definitions
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: automationTriggerEnum("trigger").notNull(),
  conditions: jsonb("conditions"), // Filter conditions (e.g., { guideStatus: 'published' })
  actions: jsonb("actions").notNull(), // Array of actions to execute
  isActive: boolean("is_active").default(true).notNull(),
  runCount: integer("run_count").default(0).notNull(),
  lastRunAt: timestamp("last_run_at"),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Automation execution logs
export const automationLogs = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").references(() => automations.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  triggeredBy: text("triggered_by"), // Event or user ID that triggered
  triggerEvent: text("trigger_event").notNull(),
  triggerData: jsonb("trigger_data"), // Input data from trigger
  actionsExecuted: jsonb("actions_executed"), // Results of each action
  status: text("status").notNull(), // 'success', 'partial', 'failed'
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook delivery logs
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").references(() => webhooks.id).notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  success: boolean("success").default(false).notNull(),
  attemptCount: integer("attempt_count").default(1).notNull(),
  executionTimeMs: integer("execution_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Analytics events for tracking
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  userId: text("user_id").references(() => users.id),
  sessionId: text("session_id"),
  eventName: text("event_name").notNull(),
  eventCategory: text("event_category"), // 'guide', 'user', 'billing', 'feature'
  eventData: jsonb("event_data"),
  source: text("source"), // 'web', 'extension', 'api'
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"), // Hashed IP for privacy
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === RELATIONS ===

export const stepAssignmentsRelations = relations(stepAssignments, ({ one }) => ({
  step: one(steps, {
    fields: [stepAssignments.stepId],
    references: [steps.id],
  }),
  guide: one(guides, {
    fields: [stepAssignments.guideId],
    references: [guides.id],
  }),
  workspace: one(workspaces, {
    fields: [stepAssignments.workspaceId],
    references: [workspaces.id],
  }),
  assignee: one(users, {
    fields: [stepAssignments.assigneeId],
    references: [users.id],
  }),
  assignedBy: one(users, {
    fields: [stepAssignments.assignedById],
    references: [users.id],
  }),
}));

export const guideApprovalsRelations = relations(guideApprovals, ({ one }) => ({
  guide: one(guides, {
    fields: [guideApprovals.guideId],
    references: [guides.id],
  }),
  workspace: one(workspaces, {
    fields: [guideApprovals.workspaceId],
    references: [workspaces.id],
  }),
  requestedBy: one(users, {
    fields: [guideApprovals.requestedById],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [guideApprovals.reviewerId],
    references: [users.id],
  }),
}));

export const stepCommentsRelations = relations(stepComments, ({ one, many }) => ({
  step: one(steps, {
    fields: [stepComments.stepId],
    references: [steps.id],
  }),
  guide: one(guides, {
    fields: [stepComments.guideId],
    references: [guides.id],
  }),
  workspace: one(workspaces, {
    fields: [stepComments.workspaceId],
    references: [workspaces.id],
  }),
  author: one(users, {
    fields: [stepComments.authorId],
    references: [users.id],
  }),
  parent: one(stepComments, {
    fields: [stepComments.parentId],
    references: [stepComments.id],
    relationName: "comment_replies",
  }),
  replies: many(stepComments, {
    relationName: "comment_replies",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  guide: one(guides, {
    fields: [notifications.guideId],
    references: [guides.id],
  }),
  step: one(steps, {
    fields: [notifications.stepId],
    references: [steps.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));

export const teamActivityRelations = relations(teamActivity, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [teamActivity.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [teamActivity.userId],
    references: [users.id],
  }),
}));

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
  translations: many(guideTranslations),
}));

export const stepsRelations = relations(steps, ({ one, many }) => ({
  guide: one(guides, {
    fields: [steps.guideId],
    references: [guides.id],
  }),
  translations: many(stepTranslations),
}));

export const guideTranslationsRelations = relations(guideTranslations, ({ one }) => ({
  guide: one(guides, {
    fields: [guideTranslations.guideId],
    references: [guides.id],
  }),
}));

export const stepTranslationsRelations = relations(stepTranslations, ({ one }) => ({
  step: one(steps, {
    fields: [stepTranslations.stepId],
    references: [steps.id],
  }),
  guide: one(guides, {
    fields: [stepTranslations.guideId],
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

export const insertContentPageSchema = createInsertSchema(contentPages).omit({
  id: true,
  publishedAt: true,
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

export type ContentPage = typeof contentPages.$inferSelect;
export type InsertContentPage = z.infer<typeof insertContentPageSchema>;

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

// === COLLABORATION SCHEMAS ===

export const insertStepAssignmentSchema = createInsertSchema(stepAssignments).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertGuideApprovalSchema = createInsertSchema(guideApprovals).omit({
  id: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertStepCommentSchema = createInsertSchema(stepComments).omit({
  id: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  readAt: true,
  createdAt: true
});

export const insertTeamActivitySchema = createInsertSchema(teamActivity).omit({
  id: true,
  createdAt: true
});

// === COLLABORATION TYPES ===

export type StepAssignment = typeof stepAssignments.$inferSelect;
export type InsertStepAssignment = z.infer<typeof insertStepAssignmentSchema>;

export type GuideApproval = typeof guideApprovals.$inferSelect;
export type InsertGuideApproval = z.infer<typeof insertGuideApprovalSchema>;

export type StepComment = typeof stepComments.$inferSelect;
export type InsertStepComment = z.infer<typeof insertStepCommentSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type TeamActivity = typeof teamActivity.$inferSelect;
export type InsertTeamActivity = z.infer<typeof insertTeamActivitySchema>;

// Extended types with user info
export type StepAssignmentWithUsers = StepAssignment & {
  assignee: { id: string; email: string; firstName: string | null; lastName: string | null };
  assignedBy: { id: string; email: string; firstName: string | null; lastName: string | null };
};

export type StepCommentWithAuthor = StepComment & {
  author: { id: string; email: string; firstName: string | null; lastName: string | null };
  replies?: StepCommentWithAuthor[];
};

export type GuideApprovalWithUsers = GuideApproval & {
  requestedBy: { id: string; email: string; firstName: string | null; lastName: string | null };
  reviewer?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  guide?: { id: number; title: string };
};

export type NotificationWithActor = Notification & {
  actor?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
};

// === TRANSLATION SCHEMAS ===

export const insertGuideTranslationSchema = createInsertSchema(guideTranslations).omit({
  id: true,
  translatedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertStepTranslationSchema = createInsertSchema(stepTranslations).omit({
  id: true,
  translatedAt: true,
  createdAt: true,
  updatedAt: true
});

// === TRANSLATION TYPES ===

export type GuideTranslation = typeof guideTranslations.$inferSelect;
export type InsertGuideTranslation = z.infer<typeof insertGuideTranslationSchema>;

export type StepTranslation = typeof stepTranslations.$inferSelect;
export type InsertStepTranslation = z.infer<typeof insertStepTranslationSchema>;

// Extended types for translations
export type GuideWithTranslations = Guide & { translations: GuideTranslation[] };
export type StepWithTranslations = Step & { translations: StepTranslation[] };

// === VOICEOVER SCHEMAS ===

export const insertStepVoiceoverSchema = createInsertSchema(stepVoiceovers).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true
});

export type StepVoiceover = typeof stepVoiceovers.$inferSelect;
export type InsertStepVoiceover = z.infer<typeof insertStepVoiceoverSchema>;

// === REDACTION SCHEMAS ===

export const insertRedactionRegionSchema = createInsertSchema(redactionRegions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type RedactionRegion = typeof redactionRegions.$inferSelect;
export type InsertRedactionRegion = z.infer<typeof insertRedactionRegionSchema>;

// === INTEGRATION SCHEMAS ===

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  lastSyncAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  lastTriggeredAt: true,
  failureCount: true,
  createdAt: true,
  updatedAt: true
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  runCount: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  createdAt: true
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true
});

// === INTEGRATION TYPES ===

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;

export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Integration provider type
export type IntegrationProvider = typeof integrationProviderEnum.enumValues[number];
export type AutomationTrigger = typeof automationTriggerEnum.enumValues[number];
export type AutomationAction = typeof automationActionEnum.enumValues[number];
