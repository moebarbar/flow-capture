import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email/Password Registration
  app.post("/api/auth/register", async (req, res) => {
    // Guard: ensure session middleware is active
    if (!req.session) {
      console.error("Session middleware not available");
      return res.status(500).json({ message: "Server configuration error" });
    }

    try {
      const data = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await authStorage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // Generate unique user ID
      const userId = crypto.randomUUID();

      // Create user
      const user = await authStorage.upsertUser({
        id: userId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      // Create session
      const sessionUser = {
        claims: {
          sub: userId,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Session creation error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        // Save session explicitly to ensure cookie is set before response
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          res.status(201).json({ 
            message: "Account created successfully",
            user: { id: userId, email: data.email, firstName: data.firstName, lastName: data.lastName }
          });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: error.errors[0].message,
          field: error.errors[0].path.join('.')
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Email/Password Login
  app.post("/api/auth/login", async (req, res) => {
    // Guard: ensure session middleware is active
    if (!req.session) {
      console.error("Session middleware not available");
      return res.status(500).json({ message: "Server configuration error" });
    }

    try {
      const data = loginSchema.parse(req.body);

      // Find user by email
      const user = await authStorage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user has a password (might be OAuth-only user)
      if (!user.passwordHash) {
        return res.status(401).json({ message: "This account uses a different login method" });
      }

      // Verify password
      const isValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        // Save session explicitly to ensure cookie is set before response
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          res.json({ 
            message: "Logged in successfully",
            user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }
          });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: error.errors[0].message,
          field: error.errors[0].path.join('.')
        });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Email/Password Logout (works for both auth methods)
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}
