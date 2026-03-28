import 'dotenv/config'

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const app = express();
const httpServer = createServer(app);

// 1. Security Headers (ASVS 14.4.4-7)
app.use(helmet({
  // ASVS 14.4.3 – Content Security Policy
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
}));

// 2. Enforce HTTPS in Production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  next();
});

// 3. CSRF Protection for API (Strict Origin Check)
app.use((req, res, next) => {
  const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (allowedMethods.includes(req.method)) return next();
  
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  const sourceUrl = origin || referer;

  if (sourceUrl && host) {
    try {
      const originHost = new URL(sourceUrl).host;
      if (originHost !== host) {
        return res.status(403).json({ message: "CSRF check failed - Bad Origin or Referer" });
      }
    } catch (e) {
      return res.status(403).json({ message: "CSRF check failed - Invalid Source URL" });
    }
  } else if (process.env.NODE_ENV === "production") {
    // In production, require at least origin or referer for mutating requests
    return res.status(403).json({ message: "CSRF check failed - Missing Origin/Referer" });
  }
  next();
});

// 4. Rate Limiting: Global API limit (100 reqs / 15 mins)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { message: "Too many requests, please try again later" },
});
app.use('/api/', apiLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

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
  await registerRoutes(httpServer, app);

  // ASVS 7.4.1 / 7.4.3 – Global Exception Handler with generic error messages
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
      const validationError = fromZodError(err);
      return res.status(400).json({ message: validationError.message });
    }

    const status = err.status || err.statusCode || 500;
    // ASVS 7.4.1 – Never expose internal error details to end users
    const message = status < 500 ? err.message : "Internal Server Error";

    // Log full error details server-side only
    console.error(`[ERROR] ${status}:`, err.message || err);
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // ASVS 14.3.2 – Debug mode disabled in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "localhost", () => {
  log(`serving on port ${port}`);
  });
})();
