import { users, type User, type UpsertUser } from "@shared/models/auth";
import { workspaces, workspaceMembers } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);
    const isNewUser = !existingUser;

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (isNewUser) {
      await this.createDefaultWorkspace(user);
    }

    return user;
  }

  private async createDefaultWorkspace(user: User): Promise<void> {
    try {
      const firstName = user.firstName || "My";
      const slug = `personal-${user.id.slice(0, 8)}-${Date.now()}`;
      
      const [workspace] = await db.insert(workspaces).values({
        name: `${firstName}'s Workspace`,
        slug,
        ownerId: user.id,
      }).returning();

      await db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });
    } catch (error) {
      console.error("Failed to create default workspace for user:", user.id, error);
    }
  }
}

export const authStorage = new AuthStorage();
