import { users, type User, type UpsertUser } from "@shared/models/auth";
import { workspaces, workspaceMembers } from "@shared/schema";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getTokenVersion(id: string): Promise<number | null>;
  incrementTokenVersion(id: string): Promise<number>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Lightweight lookup used on every extension-token request
  async getTokenVersion(id: string): Promise<number | null> {
    const [row] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, id));
    return row ? row.tokenVersion : null;
  }

  // Revokes all outstanding extension tokens for the user
  async incrementTokenVersion(id: string): Promise<number> {
    const [row] = await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ tokenVersion: users.tokenVersion });
    return row?.tokenVersion ?? 0;
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
