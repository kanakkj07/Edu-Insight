import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import MemoryStore from "memorystore";
import rateLimit from "express-rate-limit";

const scryptAsync = promisify(scrypt);
const SessionStore = MemoryStore(session);

/* =========================================================
   ASVS 7.1.3 – Security Event Logging
========================================================= */
export function securityLog(event: string, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, event, ...details };
  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

/* =========================================================
   ASVS 2.1.7 – Breached Password List (Top Common Passwords)
========================================================= */
const BREACHED_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123",
  "monkey", "1234567", "letmein", "trustno1", "dragon",
  "baseball", "iloveyou", "master", "sunshine", "ashley",
  "bailey", "passw0rd", "shadow", "123456789", "654321",
  "superman", "qazwsx", "michael", "football", "password1",
  "password123", "password1234", "password12345", "admin",
  "admin123", "root", "toor", "pass", "test",
  "guest", "master123", "changeme", "hello", "charlie",
  "donald", "welcome", "login", "starwars", "solo",
  "princess", "qwerty123", "welcome1", "password123456",
]);

export function isBreachedPassword(password: string): boolean {
  return BREACHED_PASSWORDS.has(password.toLowerCase());
}

declare module "express-session" {
  interface SessionData {
    passport?: any;
  }
}

/* =========================================================
   ASVS 2.4.4 – Scrypt with cost factor N=16384 (≥13)
========================================================= */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await (scryptAsync as any)(password, salt, 64, SCRYPT_PARAMS)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await (scryptAsync as any)(supplied, salt, 64, SCRYPT_PARAMS)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "super-secret-key-fallback",
    resave: false,
    saveUninitialized: false,
    name: "sessionId",
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes timeout
    },
    store: new SessionStore({
      checkPeriod: 86400000,
    }),
  };

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 mins for auth routes
    message: { message: "Too many login/register attempts, please try again later" },
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          securityLog("LOGIN_FAILED", { email, reason: "Invalid credentials" });
          return done(null, false);
        } else {
          securityLog("LOGIN_SUCCESS", { userId: user.id, email });
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      // ASVS 2.1.7 – Check against breached password list
      if (isBreachedPassword(req.body.password)) {
        securityLog("REGISTER_BLOCKED", { email: req.body.email, reason: "Breached password" });
        return res.status(400).json({ message: "This password is too common and has been found in data breaches. Please choose a stronger password." });
      }

      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).send("Email already in use");
      }

      // Role Logic
      if (req.body.role === "student") {
        const invite = await storage.getStudentByEmail(req.body.email);
        if (!invite) {
          return res.status(403).send("No invitation found from a teacher. Please ask your teacher to add you first.");
        }
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      if (req.body.role === "student") {
        await storage.linkStudentAccount(user.email, user.id);
      }

      req.login(user, (err) => {
        if (err) return next(err);
        const tempPassport = req.session.passport;
        req.session.regenerate((err2) => {
          if (err2) return next(err2);
          req.session.passport = tempPassport;
          req.session.save((err3) => {
            if (err3) return next(err3);
            res.status(201).json(user);
          });
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", authLimiter, passport.authenticate("local"), (req, res, next) => {
    const tempPassport = req.session.passport;
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.passport = tempPassport;
      req.session.save((err2) => {
        if (err2) return next(err2);
        res.status(200).json(req.user);
      });
    });
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = (req.user as User)?.id;
    securityLog("LOGOUT", { userId });
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err2) => {
        if (err2) return next(err2);
        res.clearCookie("sessionId");
        res.sendStatus(200);
      });
    });
  });

  // ASVS 3.7.1 – Re-authentication for sensitive operations
  app.post("/api/reauth", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as User;
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Password required" });
    const fullUser = await storage.getUserByEmail(user.email);
    if (!fullUser || !(await comparePasswords(password, fullUser.password))) {
      securityLog("REAUTH_FAILED", { userId: user.id });
      return res.status(403).json({ message: "Re-authentication failed" });
    }
    securityLog("REAUTH_SUCCESS", { userId: user.id });
    return res.status(200).json({ verified: true });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
