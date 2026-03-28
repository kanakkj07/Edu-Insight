import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

/* =========================================================
   SECURITY UTILS — COMPREHENSIVE INPUT VALIDATION
   Covers all attack vectors:
   1. <script>alert('xss')</script>             → XSS via HTML tags
   2. <img onerror=alert(1)>                    → XSS via event handlers
   3. ' OR 1=1 ; select * from users ;          → SQL injection
   4. %3Cscript%3E                              → URL-encoded XSS
   5. %253Cscript%253E                          → Double-encoded XSS
   6. 192.8.8.9 ; rm -rf /                      → Command injection
   7. javascript:alert('Hacked')                → Protocol-based XSS
   8. & ls  OR | ls                             → Command injection operators
========================================================= */

/**
 * Step 1: Decode URL-encoded & double-encoded payloads
 * Attackers use %3C (%3Cscript%3E) or %253C (%253Cscript%253E)
 * to bypass filters that only check raw text.
 */
function decodeAllEncodings(val: string): string {
  let decoded = val;
  let previous = "";
  // Decode repeatedly until no more encoded chars remain (handles double/triple encoding)
  let iterations = 0;
  while (decoded !== previous && iterations < 5) {
    previous = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break; // malformed encoding — stop decoding
    }
    iterations++;
  }
  return decoded;
}

/**
 * Step 2: Strip ALL HTML/XML tags — blocks <script>, <img onerror=...>, <a href=...>, etc.
 */
function stripHtmlTags(val: string): string {
  return val.replace(/<[^>]*>?/gm, "");
}

/**
 * Step 3: Block dangerous event handler attributes even without full tags
 * e.g., onerror=alert(1), onload=..., onclick=...
 */
function stripEventHandlers(val: string): string {
  return val.replace(/\bon\w+\s*=\s*[^\s>]*/gi, "");
}

/**
 * Step 4: Block javascript: / data: / vbscript: protocol URLs
 * Prevents <a href="javascript:alert('Hacked')">
 */
function stripDangerousProtocols(val: string): string {
  return val.replace(/\b(javascript|vbscript|data)\s*:/gi, "");
}

/**
 * Step 5: Neutralize SQL Injection patterns
 * Blocks: ' OR 1=1, ; SELECT *, UNION SELECT, DROP TABLE, etc.
 */
function stripSqlInjection(val: string): string {
  // Remove SQL comment markers
  let clean = val.replace(/--/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove dangerous SQL keywords when surrounded by non-alphanumeric chars
  const sqlPatterns = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|DECLARE)\b/gi;
  clean = clean.replace(sqlPatterns, "");
  // Remove ' OR / ' AND patterns (classic SQLi)
  clean = clean.replace(/'\s*(OR|AND)\s*/gi, "");
  return clean;
}

/**
 * Step 6: Neutralize Command Injection operators
 * Blocks: ; rm -rf /, | ls, & whoami, $(...), `...`
 */
function stripCommandInjection(val: string): string {
  // Remove shell operators: ; | & ` $( )
  return val.replace(/[;|&`$]/g, "").replace(/\$\(/g, "");
}

/**
 * MASTER SANITIZER — chains all 6 layers of defense.
 * Applied via Zod .transform() on every user-facing text field.
 */
export const sanitizeInput = (val: string): string => {
  let clean = val;
  clean = decodeAllEncodings(clean);     // Decode %3C, %253C etc.
  clean = stripHtmlTags(clean);          // Remove <script>, <img> etc.
  clean = stripEventHandlers(clean);     // Remove onerror=, onclick= etc.
  clean = stripDangerousProtocols(clean);// Remove javascript:, data: etc.
  clean = stripSqlInjection(clean);      // Remove SQL keywords & patterns
  clean = stripCommandInjection(clean);  // Remove ; | & ` etc.
  return clean.trim();
};

// Backward-compatible alias
export const stripHtml = sanitizeInput;

/* =========================================================
   TABLE DEFINITIONS
========================================================= */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["student", "teacher"] }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Link between students and teachers
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  teacherId: integer("teacher_id").references(() => users.id),
  email: text("email").notNull(),
  isRegistered: boolean("is_registered").default(false),
});

export const academicRecords = pgTable("academic_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),

  attendancePercentage: decimal("attendance_percentage").notNull(),
  cgpa: decimal("cgpa").notNull(), // Keep as overall avg CGPA

  backlogs: integer("backlogs").default(0),
  studyHoursPerDay: integer("study_hours_per_day"),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export const semesterRecords = pgTable("semester_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),

  semesterNumber: integer("semester_number").notNull(),
  cgpa: decimal("cgpa").notNull(),
  
  academicRecordId: integer("academic_record_id")
    .references(() => academicRecords.id), // Link to the specific update event

  createdAt: timestamp("created_at").defaultNow(),
});

export const stressRecords = pgTable("stress_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),

  answers: jsonb("answers").notNull(),
  stressScore: integer("stress_score").notNull(), // 0–100

  createdAt: timestamp("created_at").defaultNow(),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),

  riskScore: decimal("risk_score").notNull(), // 0.0 – 1.0
  riskLevel: text("risk_level", {
    enum: ["Low", "Moderate", "High", "Critical"],
  }).notNull(),

  factors: jsonb("factors"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   NEW FEATURE TABLES
========================================================= */

// F5: Mood & Wellness Journal
export const moodEntries = pgTable("mood_entries", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  mood: integer("mood").notNull(), // 1-5 emoji scale
  note: text("note"), // optional free-text
  createdAt: timestamp("created_at").defaultNow(),
});

// F6: Teacher-Student Messaging
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// F6: Intervention Tracking
export const interventions = pgTable("interventions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["counseling", "parent_contact", "academic_support", "referral", "other"] }).notNull(),
  notes: text("notes"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at").defaultNow(),
});

// F9: Achievements & Gamification
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // e.g., "streak_7", "cgpa_improved", "stress_improved"
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"), // emoji or icon name
  earnedAt: timestamp("earned_at").defaultNow(),
});

// F7: Study Sessions (Pomodoro)
export const studySessions = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  duration: integer("duration").notNull(), // minutes
  subject: text("subject"),
  completedAt: timestamp("completed_at").defaultNow(),
});

// F9: Goals
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  target: decimal("target"), // numeric target
  current: decimal("current").default("0"),
  type: text("type", { enum: ["cgpa", "attendance", "study_hours", "stress_reduction", "custom"] }).notNull(),
  isCompleted: boolean("is_completed").default(false),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow(),
});

// F3: Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { enum: ["risk_alert", "reminder", "achievement", "message", "system"] }).notNull(),
  isRead: boolean("is_read").default(false),
  link: text("link"), // optional deep link
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================
   RELATIONS
========================================================= */

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  teacherStudents: many(students, {
    relationName: "teacherStudents",
  }),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  teacher: one(users, {
    fields: [students.teacherId],
    references: [users.id],
    relationName: "teacherStudents",
  }),
}));

/* =========================================================
   INSERT SCHEMAS (ZOD) — FIXED & SAFE
========================================================= */

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email().max(100).transform(stripHtml),
  password: z.string().min(12, "Password must be at least 12 characters").max(100),
  name: z.string().min(1).max(100).transform(stripHtml),
}).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students, {
  email: z.string().email().max(100).transform(stripHtml),
}).omit({
  id: true,
  userId: true,
});

/**
 * 🔥 IMPORTANT FIX:
 * PostgreSQL `decimal` → string by default
 * We MUST coerce to numbers
 */
export const insertAcademicSchema = createInsertSchema(academicRecords, {
  attendancePercentage: z.coerce.number().min(0).max(100),
  cgpa: z.coerce.number().min(0).max(10).optional(), // This now can be calculated by the backend if not provided directly
  backlogs: z.coerce.number().int().min(0).max(100),
  studyHoursPerDay: z.coerce.number().int().min(0).max(24),
}).extend({
  cgpas: z.array(
    z.object({
      semesterNumber: z.coerce.number().int().min(1),
      cgpa: z.coerce.number().min(0).max(10)
    })
  ).min(1).optional()
}).omit({
  id: true,
  updatedAt: true,
});

export const insertSemesterSchema = createInsertSchema(semesterRecords, {
  cgpa: z.coerce.number().min(0).max(10),
  semesterNumber: z.coerce.number().int().min(1),
}).omit({
  id: true,
  createdAt: true,
  academicRecordId: true,
});

/**
 * Stress score is calculated backend
 */
export const insertStressSchema = createInsertSchema(stressRecords, {
  stressScore: z.coerce.number().int().min(0).max(100),
}).omit({
  id: true,
  createdAt: true,
});

/**
 * Prediction insert schema
 */
export const insertPredictionSchema = createInsertSchema(predictions, {
  riskScore: z.coerce.number().min(0).max(1),
}).omit({
  id: true,
  createdAt: true,
});

/* =========================================================
   NEW FEATURE INSERT SCHEMAS
========================================================= */

export const insertMoodSchema = createInsertSchema(moodEntries, {
  mood: z.coerce.number().int().min(1).max(5),
  note: z.string().max(500).transform(stripHtml).optional(),
}).omit({ id: true, createdAt: true });

export const insertMessageSchema = createInsertSchema(messages, {
  content: z.string().min(1).max(2000).transform(stripHtml),
}).omit({ id: true, isRead: true, createdAt: true });

export const insertInterventionSchema = createInsertSchema(interventions, {
  notes: z.string().max(1000).transform(stripHtml).optional(),
  outcome: z.string().max(500).transform(stripHtml).optional(),
}).omit({ id: true, createdAt: true });

export const insertAchievementSchema = createInsertSchema(achievements, {
  title: z.string().min(1).max(100).transform(stripHtml),
  description: z.string().max(300).transform(stripHtml).optional(),
}).omit({ id: true, earnedAt: true });

export const insertStudySessionSchema = createInsertSchema(studySessions, {
  duration: z.coerce.number().int().min(1).max(600),
  subject: z.string().max(100).transform(stripHtml).optional(),
}).omit({ id: true, completedAt: true });

export const insertGoalSchema = createInsertSchema(goals, {
  title: z.string().min(1).max(200).transform(stripHtml),
  target: z.coerce.number().min(0).optional(),
  current: z.coerce.number().min(0).optional(),
}).omit({ id: true, isCompleted: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications, {
  title: z.string().min(1).max(200).transform(stripHtml),
  message: z.string().min(1).max(500).transform(stripHtml),
}).omit({ id: true, isRead: true, createdAt: true });

/* =========================================================
   TYPES (API CONTRACTS)
========================================================= */

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type AcademicRecord = typeof academicRecords.$inferSelect;
export type InsertAcademic = z.infer<typeof insertAcademicSchema>;

export type SemesterRecord = typeof semesterRecords.$inferSelect;
export type InsertSemester = z.infer<typeof insertSemesterSchema>;

export type StressRecord = typeof stressRecords.$inferSelect;
export type InsertStress = z.infer<typeof insertStressSchema>;

export type Prediction = typeof predictions.$inferSelect;

export type MoodEntry = typeof moodEntries.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Intervention = typeof interventions.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

/* =========================================================
   AUTH TYPES
========================================================= */

export type LoginRequest = Pick<InsertUser, "email" | "password">;
export type RegisterRequest = InsertUser;

/* =========================================================
   DASHBOARD RESPONSE TYPES
========================================================= */

export type StudentDashboardData = {
  student: User;
  academic: AcademicRecord | null;
  latestStress: StressRecord | null;
  prediction: Prediction | null;
  history: {
    stress: StressRecord[];
    academic: AcademicRecord[];
    semesters: SemesterRecord[];
  };
  semesterRecords: SemesterRecord[];
  moodEntries: MoodEntry[];
  achievements: Achievement[];
  studySessions: StudySession[];
  goals: Goal[];
  recommendations: string[];
  notifications: Notification[];
};

export type TeacherDashboardData = {
  students: (User & {
    riskLevel?: string;
    riskScore?: number;
    lastUpdated?: string;
  })[];
};
