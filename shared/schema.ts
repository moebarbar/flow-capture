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

// === RELATIONS ===

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

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
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

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

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
