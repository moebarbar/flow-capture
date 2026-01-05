import { db } from '../db';
import { workspaceInvitations, workspaceMembers, workspaces, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { emailService } from './emailService';
import { billingService } from './billingService';

const INVITATION_EXPIRY_HOURS = 168;

export class InvitationService {
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async hashToken(token: string): Promise<string> {
    return await bcrypt.hash(token, 10);
  }

  async verifyToken(token: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(token, hash);
  }

  async createInvitation(
    workspaceId: number,
    email: string,
    invitedById: string,
    role: 'owner' | 'admin' | 'editor' | 'viewer' = 'editor'
  ) {
    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!workspace.length) {
      throw new Error('Workspace not found');
    }

    const workspaceOwnerId = workspace[0].ownerId;

    const canAdd = await billingService.canAddMember(workspaceOwnerId);
    if (!canAdd.allowed) {
      if (canAdd.requiresUpgrade) {
        throw new Error('UPGRADE_REQUIRED: Your current plan does not allow additional team members. Please upgrade to Pro.');
      }
      throw new Error('SEAT_LIMIT: You have reached your seat limit. Please add more seats to invite new members.');
    }

    const existingMember = await db.select()
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(users.email, email)
      ))
      .limit(1);

    if (existingMember.length) {
      throw new Error('User is already a member of this workspace');
    }

    const existingInvite = await db.select()
      .from(workspaceInvitations)
      .where(and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.email, email),
        eq(workspaceInvitations.status, 'pending')
      ))
      .limit(1);

    if (existingInvite.length) {
      throw new Error('An invitation has already been sent to this email');
    }

    const token = this.generateToken();
    const tokenHash = await this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

    const [invitation] = await db.insert(workspaceInvitations)
      .values({
        workspaceId,
        email,
        role,
        invitedById,
        tokenHash,
        status: 'pending',
        expiresAt
      })
      .returning();

    const inviterUser = await db.select().from(users).where(eq(users.id, invitedById)).limit(1);
    const inviterName = inviterUser[0]?.firstName 
      ? `${inviterUser[0].firstName} ${inviterUser[0].lastName || ''}`.trim()
      : 'A team member';

    await this.sendInvitationEmail(email, workspace[0].name, inviterName, token, invitation.id);

    return { ...invitation, token };
  }

  async sendInvitationEmail(
    email: string,
    workspaceName: string,
    inviterName: string,
    token: string,
    invitationId: number
  ) {
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    
    const acceptUrl = `${baseUrl}/invite/accept?token=${token}&id=${invitationId}`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">You're invited to join ${workspaceName}</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          ${inviterName} has invited you to collaborate on <strong>${workspaceName}</strong> in FlowCapture.
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          FlowCapture helps teams create step-by-step documentation with automatic screenshots and AI-powered descriptions.
        </p>
        <div style="margin: 32px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">
          This invitation will expire in ${INVITATION_EXPIRY_HOURS / 24} days. If you don't want to join, you can ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #999; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${acceptUrl}" style="color: #6366f1;">${acceptUrl}</a>
        </p>
      </div>
    `;

    const textContent = `
You're invited to join ${workspaceName}

${inviterName} has invited you to collaborate on ${workspaceName} in FlowCapture.

Accept your invitation by visiting this link:
${acceptUrl}

This invitation will expire in ${INVITATION_EXPIRY_HOURS / 24} days.
    `.trim();

    await emailService.sendGenericEmail({
      to: email,
      subject: `You're invited to join ${workspaceName} on FlowCapture`,
      html: htmlContent,
      text: textContent
    });
  }

  async acceptInvitation(invitationId: number, token: string, acceptingUserId: string) {
    const [invitation] = await db.select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('This invitation is no longer valid');
    }

    if (new Date() > invitation.expiresAt) {
      await db.update(workspaceInvitations)
        .set({ status: 'expired' })
        .where(eq(workspaceInvitations.id, invitationId));
      throw new Error('This invitation has expired');
    }

    const isValidToken = await this.verifyToken(token, invitation.tokenHash);
    if (!isValidToken) {
      throw new Error('Invalid invitation token');
    }

    const acceptingUser = await db.select().from(users).where(eq(users.id, acceptingUserId)).limit(1);
    if (!acceptingUser.length) {
      throw new Error('User not found');
    }

    if (acceptingUser[0].email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    const existingMember = await db.select()
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, invitation.workspaceId),
        eq(workspaceMembers.userId, acceptingUserId)
      ))
      .limit(1);

    if (existingMember.length) {
      throw new Error('You are already a member of this workspace');
    }

    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, invitation.workspaceId)).limit(1);
    if (!workspace.length) {
      throw new Error('Workspace not found');
    }

    const canAdd = await billingService.canAddMember(workspace[0].ownerId);
    if (!canAdd.allowed && !canAdd.requiresUpgrade) {
      const subscription = await billingService.getUserSubscription(workspace[0].ownerId);
      if (subscription?.plan === 'pro') {
        await billingService.updateSeatQuantity(workspace[0].ownerId, canAdd.maxSeats + 1);
      } else {
        throw new Error('The workspace owner needs to upgrade their plan or add more seats');
      }
    }

    const [member] = await db.insert(workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId: acceptingUserId,
        role: invitation.role
      })
      .returning();

    await db.update(workspaceInvitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(workspaceInvitations.id, invitationId));

    return {
      success: true,
      workspace: workspace[0],
      member
    };
  }

  async declineInvitation(invitationId: number, token: string) {
    const [invitation] = await db.select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const isValidToken = await this.verifyToken(token, invitation.tokenHash);
    if (!isValidToken) {
      throw new Error('Invalid invitation token');
    }

    await db.update(workspaceInvitations)
      .set({ status: 'declined' })
      .where(eq(workspaceInvitations.id, invitationId));

    return { success: true };
  }

  async getWorkspaceInvitations(workspaceId: number) {
    return await db.select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.workspaceId, workspaceId))
      .orderBy(workspaceInvitations.createdAt);
  }

  async cancelInvitation(invitationId: number, userId: string) {
    const [invitation] = await db.select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const workspace = await db.select()
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId))
      .limit(1);

    const member = await db.select()
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, invitation.workspaceId),
        eq(workspaceMembers.userId, userId)
      ))
      .limit(1);

    const isOwner = workspace[0]?.ownerId === userId;
    const isAdmin = member[0]?.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to cancel this invitation');
    }

    await db.update(workspaceInvitations)
      .set({ status: 'expired' })
      .where(eq(workspaceInvitations.id, invitationId));

    return { success: true };
  }

  async getInvitationByToken(invitationId: number, token: string) {
    const [invitation] = await db.select({
      invitation: workspaceInvitations,
      workspace: workspaces
    })
      .from(workspaceInvitations)
      .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      return null;
    }

    const isValidToken = await this.verifyToken(token, invitation.invitation.tokenHash);
    if (!isValidToken) {
      return null;
    }

    return {
      ...invitation.invitation,
      workspaceName: invitation.workspace.name
    };
  }
}

export const invitationService = new InvitationService();
