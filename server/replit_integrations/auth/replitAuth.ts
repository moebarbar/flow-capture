import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "crypto";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  // Detect HTTPS deployment: either NODE_ENV=production or APP_URL starts with https://
  // This handles Railway deployments where NODE_ENV may not be explicitly set.
  const isHttps = process.env.NODE_ENV === "production" ||
    (process.env.APP_URL || '').startsWith('https://');
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isHttps,
      // sameSite 'none' + secure allows Chrome extension service workers to send cookies
      // cross-origin to the Railway HTTPS server.
      sameSite: isHttps ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

// --- Extension token helpers (HMAC-signed, no DB required) ---
const EXTENSION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createExtensionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + EXTENSION_TOKEN_TTL_MS })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyExtensionToken(token: string): { userId: string } | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expectedSig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest("base64url");
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    )
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() > data.exp) return null;
    return { userId: data.sub };
  } catch {
    return null;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Redirect legacy Replit OAuth routes to the auth page
  app.get("/api/login", (_req, res) => res.redirect("/auth"));
  app.get("/api/callback", (_req, res) => res.redirect("/auth"));
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/auth"));
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  // 1. Try session-based auth (web app)
  const sessionUser = req.user as any;
  if (req.isAuthenticated() && sessionUser?.claims?.sub) {
    return next();
  }

  // 2. Try Bearer token auth (Chrome extension)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = verifyExtensionToken(token);
    if (result) {
      // Attach a minimal user object so downstream handlers work uniformly
      (req as any).user = { claims: { sub: result.userId } };
      return next();
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};
