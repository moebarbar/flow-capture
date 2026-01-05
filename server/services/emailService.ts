import sgMail from "@sendgrid/mail";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "../db";
import { authTokens, emailSettings, users } from "@shared/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

// Token expiry times (in milliseconds)
const EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY = 1 * 60 * 60 * 1000; // 1 hour

interface EmailServiceConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

class EmailService {
  private config: EmailServiceConfig | null = null;

  async loadConfig(): Promise<EmailServiceConfig | null> {
    const [settings] = await db.select().from(emailSettings).limit(1);
    
    if (!settings?.sendgridApiKey) {
      // Try environment variable as fallback
      const apiKey = process.env.SENDGRID_API_KEY;
      if (apiKey) {
        return {
          apiKey,
          fromEmail: settings?.fromEmail || "noreply@flowcapture.com",
          fromName: settings?.fromName || "FlowCapture",
          replyToEmail: settings?.replyToEmail || undefined,
        };
      }
      return null;
    }

    return {
      apiKey: settings.sendgridApiKey,
      fromEmail: settings.fromEmail || "noreply@flowcapture.com",
      fromName: settings.fromName || "FlowCapture",
      replyToEmail: settings.replyToEmail || undefined,
    };
  }

  async initialize(): Promise<boolean> {
    this.config = await this.loadConfig();
    if (!this.config) {
      console.warn("Email service not configured - emails will not be sent");
      return false;
    }
    sgMail.setApiKey(this.config.apiKey);
    return true;
  }

  async getSettings() {
    const [settings] = await db.select().from(emailSettings).limit(1);
    return settings;
  }

  async updateSettings(data: Partial<typeof emailSettings.$inferInsert>) {
    const existing = await this.getSettings();
    if (existing) {
      const [updated] = await db
        .update(emailSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(emailSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(emailSettings).values(data as any).returning();
      return created;
    }
  }

  // Generate a secure random token
  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Hash token for storage
  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  // Create and store a verification/reset token
  async createToken(
    userId: string,
    type: "email_verification" | "password_reset"
  ): Promise<string> {
    const token = this.generateToken();
    const tokenHash = await this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + (type === "email_verification" ? EMAIL_VERIFICATION_EXPIRY : PASSWORD_RESET_EXPIRY)
    );

    // Invalidate any existing unused tokens of this type
    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.tokenType, type),
          isNull(authTokens.usedAt)
        )
      );

    // Create new token
    await db.insert(authTokens).values({
      userId,
      tokenHash,
      tokenType: type,
      expiresAt,
    });

    return token;
  }

  // Verify a token is valid and not used
  async verifyToken(
    token: string,
    type: "email_verification" | "password_reset"
  ): Promise<{ valid: boolean; userId?: string; tokenId?: number }> {
    // Get all unused tokens of this type that haven't expired
    const tokens = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenType, type),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date())
        )
      );

    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);
      if (isValid) {
        return { valid: true, userId: t.userId, tokenId: t.id };
      }
    }

    return { valid: false };
  }

  // Mark token as used
  async markTokenUsed(tokenId: number): Promise<void> {
    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, tokenId));
  }

  // Send email using SendGrid
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    if (!this.config) {
      await this.initialize();
    }
    
    if (!this.config) {
      console.error("Email service not configured");
      return false;
    }

    try {
      await sgMail.send({
        to,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        replyTo: this.config.replyToEmail || undefined,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ""),
      });
      return true;
    } catch (error: any) {
      console.error("SendGrid error:", error?.response?.body || error);
      return false;
    }
  }

  // Send email verification
  async sendVerificationEmail(
    email: string,
    userId: string,
    baseUrl: string
  ): Promise<boolean> {
    const token = await this.createToken(userId, "email_verification");
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    
    const settings = await this.getSettings();
    const subject = settings?.verificationSubject || "Verify your email address";
    
    const html = settings?.verificationTemplate?.replace("{{VERIFY_URL}}", verifyUrl) || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email Address</h2>
        <p>Thank you for signing up! Please click the button below to verify your email address.</p>
        <p style="margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
      </div>
    `;

    return this.sendEmail(email, subject, html);
  }

  // Send password reset email
  async sendPasswordResetEmail(
    email: string,
    userId: string,
    baseUrl: string
  ): Promise<boolean> {
    const token = await this.createToken(userId, "password_reset");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    const settings = await this.getSettings();
    const subject = settings?.passwordResetSubject || "Reset your password";
    
    const html = settings?.passwordResetTemplate?.replace("{{RESET_URL}}", resetUrl) || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested to reset your password. Click the button below to create a new password.</p>
        <p style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendEmail(email, subject, html);
  }

  // Send welcome email
  async sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings?.enableWelcomeEmail) {
      return true; // Skip if disabled
    }
    
    const subject = settings?.welcomeSubject || "Welcome to FlowCapture!";
    
    const html = settings?.welcomeTemplate?.replace("{{FIRST_NAME}}", firstName || "there") || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to FlowCapture!</h2>
        <p>Hi ${firstName || "there"},</p>
        <p>Thank you for joining FlowCapture. We're excited to help you create beautiful workflow documentation.</p>
        <p>Get started by:</p>
        <ul>
          <li>Installing our Chrome extension</li>
          <li>Recording your first workflow</li>
          <li>Sharing guides with your team</li>
        </ul>
        <p>If you have any questions, feel free to reach out!</p>
        <p>Best,<br/>The FlowCapture Team</p>
      </div>
    `;

    return this.sendEmail(email, subject, html);
  }

  // Mark user email as verified
  async verifyUserEmail(tokenValue: string): Promise<{ success: boolean; message: string }> {
    const { valid, userId, tokenId } = await this.verifyToken(tokenValue, "email_verification");
    
    if (!valid || !userId || !tokenId) {
      return { success: false, message: "Invalid or expired verification link" };
    }

    // Mark email as verified
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Mark token as used
    await this.markTokenUsed(tokenId);

    return { success: true, message: "Email verified successfully" };
  }

  // Reset password with token
  async resetPassword(
    tokenValue: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const { valid, userId, tokenId } = await this.verifyToken(tokenValue, "password_reset");
    
    if (!valid || !userId || !tokenId) {
      return { success: false, message: "Invalid or expired reset link" };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Mark token as used
    await this.markTokenUsed(tokenId);

    return { success: true, message: "Password reset successfully" };
  }

  // Test email configuration
  async sendTestEmail(to: string): Promise<boolean> {
    return this.sendEmail(
      to,
      "FlowCapture Email Test",
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Configuration Test</h2>
        <p>If you're reading this, your email configuration is working correctly!</p>
        <p>Sent from FlowCapture at ${new Date().toISOString()}</p>
      </div>`
    );
  }
}

export const emailService = new EmailService();
