
import { db } from "../server/db";
import { users, workspaces, workspaceMembers, guides, steps, folders } from "@shared/schema";
import { hash } from "crypto"; // Just for dummy stuff if needed, but we use replit auth
import { storage } from "../server/storage";

async function seed() {
  console.log("Seeding database...");

  // Create a user (Simulated Replit Auth user)
  // Replit Auth users are usually upserted on login. 
  // We'll create one manually to link workspaces to.
  // ID is usually a string (user-id from replit)
  const userId = "user-123-seed"; 
  
  // Check if user exists (using raw db query as storage wraps authStorage)
  // Actually we can use storage.createUser if we exposed it, or direct db insert.
  // storage.createUser expects InsertUser (username, password).
  // But our schema for 'users' in shared/schema.ts is the generic one.
  // Wait, I have TWO user tables? 
  // 1. `shared/schema.ts` -> `users` (id, username, password) -> FROM DATABASE BLUEPRINT
  // 2. `shared/models/auth.ts` -> `users` (id, email, etc) -> FROM REPLIT AUTH BLUEPRINT
  
  // AND `shared/schema.ts` EXPORTS `* from "./models/auth"`.
  // BUT `shared/schema.ts` ALSO DEFINES `export const users = ...` locally!
  // This is a conflict!
  
  // I need to check `shared/schema.ts` content again.
  // I wrote `shared/schema.ts` in Batch 2 using `write`.
  // In that write, I did:
  // `import { users } from "./models/auth";`
  // And I did NOT define `users` again locally in that file.
  // I defined `workspaces`, `guides` etc.
  
  // However, the `database` blueprint MIGHT have added `users` table snippet if I wasn't careful?
  // No, I overwrote `shared/schema.ts` entirely in Batch 2.
  // So `users` should come from `./models/auth`.
  
  // Let's verify `shared/models/auth.ts` structure.
  // It has: id, email, firstName, lastName, profileImageUrl...
  
  // So I should seed that user structure.

  const seedUser = {
    id: userId,
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    profileImageUrl: "https://placehold.co/100",
  };

  await db.insert(users).values(seedUser).onConflictDoNothing().execute();

  // Create Workspace
  const workspace = await storage.createWorkspace({
    name: "Acme Corp",
    slug: "acme-corp",
    ownerId: userId,
    primaryColor: "#7c3aed", // violet-600
  });
  console.log("Created workspace:", workspace.name);

  // Create Folder
  const folder = await storage.createFolder({
    workspaceId: workspace.id,
    name: "Onboarding",
  });
  console.log("Created folder:", folder.name);

  // Create Guide 1: How to use the platform
  const guide1 = await storage.createGuide({
    workspaceId: workspace.id,
    folderId: folder.id,
    title: "How to Create a Guide",
    description: "Learn the basics of capturing workflows.",
    createdById: userId,
    status: "published",
    coverImageUrl: "https://placehold.co/600x400/7c3aed/ffffff?text=Guide+Creation",
  });
  console.log("Created guide:", guide1.title);

  // Steps for Guide 1
  await storage.createStep({
    guideId: guide1.id,
    order: 0,
    title: "Click 'New Guide'",
    description: "Start by clicking the big blue button on the dashboard.",
    actionType: "click",
    imageUrl: "https://placehold.co/800x600?text=Dashboard+Step",
  });

  await storage.createStep({
    guideId: guide1.id,
    order: 1,
    title: "Enter Guide Details",
    description: "Fill in the title and description for your new guide.",
    actionType: "input",
    imageUrl: "https://placehold.co/800x600?text=Input+Step",
  });
  
  // Create Guide 2: Advanced Features
  const guide2 = await storage.createGuide({
    workspaceId: workspace.id,
    title: "Advanced Analytics",
    description: "Deep dive into user engagement metrics.",
    createdById: userId,
    status: "draft",
    coverImageUrl: "https://placehold.co/600x400/2563eb/ffffff?text=Analytics",
  });
  console.log("Created guide:", guide2.title);

  console.log("Seeding complete!");
}

seed().catch(console.error);
