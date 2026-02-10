import { db } from "./db";
import {
  users, students, academicRecords, stressRecords, predictions,
  type User, type InsertUser, type Student, type InsertStudent,
  type AcademicRecord, type InsertAcademic, type StressRecord,
  type Prediction
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User & Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Teacher - Student Management
  createStudentInvite(student: InsertStudent): Promise<Student>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  getStudentsByTeacher(teacherId: number): Promise<(User & { studentId: number })[]>;
  linkStudentAccount(email: string, userId: number): Promise<void>;

  // Academic Records
  updateAcademicRecord(record: InsertAcademic): Promise<AcademicRecord>;
  getAcademicRecord(studentId: number): Promise<AcademicRecord | undefined>;
  getAllAcademicRecords(studentId: number): Promise<AcademicRecord[]>;

  // Stress Records
  createStressRecord(record: Omit<StressRecord, "id" | "createdAt">): Promise<StressRecord>;
  getLatestStressRecord(studentId: number): Promise<StressRecord | undefined>;
  getAllStressRecords(studentId: number): Promise<StressRecord[]>;

  // Predictions
  createPrediction(prediction: Omit<Prediction, "id" | "createdAt">): Promise<Prediction>;
  getLatestPrediction(studentId: number): Promise<Prediction | undefined>;
}

export class DatabaseStorage implements IStorage {
  // === User ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // === Student Management ===
  async createStudentInvite(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async getStudentByEmail(email: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.email, email));
    return student;
  }

  async getStudentsByTeacher(teacherId: number): Promise<(User & { studentId: number })[]> {
    // Join students table with users table to get registered student details
    // Note: This only returns registered students. Unregistered invites are in 'students' table but have no userId.
    const result = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      password: users.password,
      createdAt: users.createdAt,
      studentId: students.id
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.teacherId, teacherId));

    return result;
  }

  async linkStudentAccount(email: string, userId: number): Promise<void> {
    await db.update(students)
      .set({ userId, isRegistered: true })
      .where(eq(students.email, email));
  }

  // === Academic ===
  async updateAcademicRecord(record: InsertAcademic): Promise<AcademicRecord> {
    const [newRecord] = await db.insert(academicRecords).values(record).returning();
    return newRecord;
  }

  async getAcademicRecord(studentId: number): Promise<AcademicRecord | undefined> {
    // Get latest
    const [record] = await db.select()
      .from(academicRecords)
      .where(eq(academicRecords.studentId, studentId))
      .orderBy(desc(academicRecords.updatedAt))
      .limit(1);
    return record;
  }

  async getAllAcademicRecords(studentId: number): Promise<AcademicRecord[]> {
    return await db.select()
      .from(academicRecords)
      .where(eq(academicRecords.studentId, studentId))
      .orderBy(desc(academicRecords.updatedAt));
  }

  // === Stress ===
  async createStressRecord(record: Omit<StressRecord, "id" | "createdAt">): Promise<StressRecord> {
    const [newRecord] = await db.insert(stressRecords).values(record).returning();
    return newRecord;
  }

  async getLatestStressRecord(studentId: number): Promise<StressRecord | undefined> {
    const [record] = await db.select()
      .from(stressRecords)
      .where(eq(stressRecords.studentId, studentId))
      .orderBy(desc(stressRecords.createdAt))
      .limit(1);
    return record;
  }

  async getAllStressRecords(studentId: number): Promise<StressRecord[]> {
    return await db.select()
      .from(stressRecords)
      .where(eq(stressRecords.studentId, studentId))
      .orderBy(desc(stressRecords.createdAt));
  }

  // === Predictions ===
  async createPrediction(prediction: Omit<Prediction, "id" | "createdAt">): Promise<Prediction> {
    const [newPrediction] = await db.insert(predictions).values(prediction).returning();
    return newPrediction;
  }

  async getLatestPrediction(studentId: number): Promise<Prediction | undefined> {
    const [pred] = await db.select()
      .from(predictions)
      .where(eq(predictions.studentId, studentId))
      .orderBy(desc(predictions.createdAt))
      .limit(1);
    return pred;
  }
}

export const storage = new DatabaseStorage();
