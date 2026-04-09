import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { emailService } from "./services/emailService";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Initialize Stripe — only if STRIPE_SECRET_KEY is present
async function initStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY not set, skipping Stripe initialization');
    return;
  }
  console.log('Stripe configured');
}

// Build the explicit allowlist of web-app origins.
// chrome-extension:// origins are always allowed (they can't be spoofed).
// Web origins: only the exact APP_URL env var and any REPLIT_DOMAINS entries.
const ALLOWED_WEB_ORIGINS = new Set<string>(
  [
    process.env.APP_URL,
    ...(process.env.REPLIT_DOMAINS?.split(",").map((d) => `https://${d.trim()}`) ?? []),
    // Allow localhost for development
    "http://localhost:5000",
    "http://localhost:3000",
  ].filter(Boolean) as string[]
);

// CORS middleware for Chrome extension support
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const isAllowed =
    origin &&
    (origin.startsWith("chrome-extension://") ||
      ALLOWED_WEB_ORIGINS.has(origin));

  if (isAllowed) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).send();
  }

  next();
});

// CSRF protection for state-changing auth endpoints.
// Strategy: verify Origin header on all POST/PUT/PATCH/DELETE to /api/auth/*.
// This protects against cross-origin cookie-based CSRF attacks (especially when
// sameSite=none is required for the Chrome extension in production).
// Bearer-token requests from the extension are exempt since they don't use cookies.
app.use("/api/auth", (req, res, next) => {
  if (["GET", "OPTIONS", "HEAD"].includes(req.method)) return next();

  // Bearer-token requests are not CSRF-vulnerable (attacker can't forge them)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Same-origin requests (no Origin header) are fine
  if (!origin && !referer) return next();

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) return next();

  // Always allow chrome-extension origins
  if (requestOrigin.startsWith("chrome-extension://")) return next();

  // Allow if in the explicit allowlist
  if (ALLOWED_WEB_ORIGINS.has(requestOrigin)) return next();

  // Allow if the origin matches the request's own host (handles Railway, any deployment)
  const host = req.headers.host;
  if (host) {
    const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const selfOrigin = `${proto}://${host}`;
    if (requestOrigin === selfOrigin) return next();
  }

  return res.status(403).json({ message: "CSRF check failed" });
});

// Stripe webhook route MUST be before express.json() middleware
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
// Increase limit to 50MB for image uploads
app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize email service (non-fatal — app works without SendGrid)
  emailService.initialize().then((ok) => {
    if (ok) {
      log("Email service initialized (SendGrid ready)");
    } else {
      log("Email service not configured — set SENDGRID_API_KEY to enable emails");
    }
  });

  // Initialize Stripe before registering routes
  await initStripe();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
