import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

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
  userId: integer("user_id").references(() => users.id), // The student's user account
  teacherId: integer("teacher_id").references(() => users.id), // The assigned teacher
  email: text("email").notNull(), // Used for invitation/linking before signup
  isRegistered: boolean("is_registered").default(false),
});

export const academicRecords = pgTable("academic_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  attendancePercentage: decimal("attendance_percentage").notNull(),
  cgpa: decimal("cgpa").notNull(),
  backlogs: integer("backlogs").default(0),
  studyHoursPerDay: integer("study_hours_per_day"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stressRecords = pgTable("stress_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  answers: jsonb("answers").notNull(), // Store full questionnaire answers
  stressScore: integer("stress_score").notNull(), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  riskScore: decimal("risk_score").notNull(), // 0.0 - 1.0
  riskLevel: text("risk_level", { enum: ["Low", "Moderate", "High", "Critical"] }).notNull(),
  factors: jsonb("factors"), // Key factors contributing to risk
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  teacherStudents: many(students, { relationName: "teacherStudents" }),
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

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, userId: true, isRegistered: true });
export const insertAcademicSchema = createInsertSchema(academicRecords).omit({ id: true, updatedAt: true });
export const insertStressSchema = createInsertSchema(stressRecords).omit({ id: true, createdAt: true, stressScore: true }); // Score calculated backend

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type AcademicRecord = typeof academicRecords.$inferSelect;
export type InsertAcademic = z.infer<typeof insertAcademicSchema>;

export type StressRecord = typeof stressRecords.$inferSelect;
export type InsertStress = z.infer<typeof insertStressSchema>; // Contains only answers

export type Prediction = typeof predictions.$inferSelect;

// Auth Types
export type LoginRequest = Pick<InsertUser, "email" | "password">;
export type RegisterRequest = InsertUser;

// API Response Types
export type StudentDashboardData = {
  student: User;
  academic: AcademicRecord | null;
  latestStress: StressRecord | null;
  prediction: Prediction | null;
  history: {
    stress: StressRecord[];
    academic: AcademicRecord[];
  };
};

export type TeacherDashboardData = {
  students: (User & {
    riskLevel?: string;
    riskScore?: number;
    lastUpdated?: string;
  })[];
};
