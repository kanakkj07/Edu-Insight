import { db } from "./db";
import {
  users, students, academicRecords, stressRecords, predictions, semesterRecords,
  moodEntries, messages, interventions, achievements, studySessions, goals, notifications,
  type User, type InsertUser, type Student, type InsertStudent,
  type AcademicRecord, type InsertAcademic, type StressRecord,
  type Prediction, type SemesterRecord, type InsertSemester,
  type MoodEntry, type Message, type Intervention, type Achievement,
  type StudySession, type Goal, type Notification
} from "@shared/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";

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
  updateSemesterRecords(studentId: number, academicRecordId: number, cgpas: { semesterNumber: number, cgpa: number }[]): Promise<SemesterRecord[]>;
  getSemesterRecords(studentId: number): Promise<SemesterRecord[]>;

  // Stress Records
  createStressRecord(record: Omit<StressRecord, "id" | "createdAt">): Promise<StressRecord>;
  getLatestStressRecord(studentId: number): Promise<StressRecord | undefined>;
  getAllStressRecords(studentId: number): Promise<StressRecord[]>;

  // Predictions
  createPrediction(prediction: Omit<Prediction, "id" | "createdAt">): Promise<Prediction>;
  getLatestPrediction(studentId: number): Promise<Prediction | undefined>;

  // Mood Entries
  createMoodEntry(entry: Omit<MoodEntry, "id" | "createdAt">): Promise<MoodEntry>;
  getMoodEntries(studentId: number, limit?: number): Promise<MoodEntry[]>;

  // Messages
  createMessage(msg: Omit<Message, "id" | "isRead" | "createdAt">): Promise<Message>;
  getMessages(userId1: number, userId2: number): Promise<Message[]>;
  getConversations(userId: number): Promise<{ userId: number; name: string; lastMessage: string; unread: number }[]>;
  markMessagesRead(senderId: number, receiverId: number): Promise<void>;

  // Interventions
  createIntervention(intervention: Omit<Intervention, "id" | "createdAt">): Promise<Intervention>;
  getInterventions(studentId: number): Promise<Intervention[]>;

  // Achievements
  createAchievement(achievement: Omit<Achievement, "id" | "earnedAt">): Promise<Achievement>;
  getAchievements(studentId: number): Promise<Achievement[]>;
  hasAchievement(studentId: number, type: string): Promise<boolean>;

  // Study Sessions
  createStudySession(session: Omit<StudySession, "id" | "completedAt">): Promise<StudySession>;
  getStudySessions(studentId: number, limit?: number): Promise<StudySession[]>;
  getTotalStudyMinutes(studentId: number): Promise<number>;

  // Goals
  createGoal(goal: Omit<Goal, "id" | "isCompleted" | "createdAt">): Promise<Goal>;
  getGoals(studentId: number): Promise<Goal[]>;
  updateGoal(goalId: number, updates: Partial<Goal>): Promise<Goal>;
  deleteGoal(goalId: number): Promise<void>;

  // Notifications
  createNotification(notification: Omit<Notification, "id" | "isRead" | "createdAt">): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationRead(notificationId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  getUnreadCount(userId: number): Promise<number>;

  // Benchmarking
  getClassBenchmark(teacherId: number): Promise<{ avgCgpa: number; avgAttendance: number; avgStress: number; totalStudents: number }>;

  // ASVS 8.3.2 – User Data Deletion
  deleteAllUserData(userId: number): Promise<void>;
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
    const { cgpas, ...academicData } = record as any;
    const [newRecord] = await db.insert(academicRecords).values(academicData).returning();
    return newRecord;
  }

  async getAcademicRecord(studentId: number): Promise<AcademicRecord | undefined> {
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

  async updateSemesterRecords(studentId: number, academicRecordId: number, cgpas: { semesterNumber: number, cgpa: number }[]): Promise<SemesterRecord[]> {
    await db.delete(semesterRecords).where(eq(semesterRecords.studentId, studentId));

    if (cgpas.length === 0) return [];

    const recordsToInsert = cgpas.map(c => ({
      studentId,
      academicRecordId,
      semesterNumber: c.semesterNumber,
      cgpa: c.cgpa.toString()
    }));

    const inserted = await db.insert(semesterRecords).values(recordsToInsert).returning();
    return inserted;
  }

  async getSemesterRecords(studentId: number): Promise<SemesterRecord[]> {
    return await db.select()
      .from(semesterRecords)
      .where(eq(semesterRecords.studentId, studentId))
      .orderBy(semesterRecords.semesterNumber);
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

  // === Mood Entries ===
  async createMoodEntry(entry: Omit<MoodEntry, "id" | "createdAt">): Promise<MoodEntry> {
    const [newEntry] = await db.insert(moodEntries).values(entry).returning();
    return newEntry;
  }

  async getMoodEntries(studentId: number, limit = 30): Promise<MoodEntry[]> {
    return await db.select()
      .from(moodEntries)
      .where(eq(moodEntries.studentId, studentId))
      .orderBy(desc(moodEntries.createdAt))
      .limit(limit);
  }

  // === Messages ===
  async createMessage(msg: Omit<Message, "id" | "isRead" | "createdAt">): Promise<Message> {
    const [newMsg] = await db.insert(messages).values(msg).returning();
    return newMsg;
  }

  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(messages.createdAt);
  }

  async getConversations(userId: number): Promise<{ userId: number; name: string; lastMessage: string; unread: number }[]> {
    // Get unique conversation partners
    const sent = await db.select({ partnerId: messages.receiverId })
      .from(messages).where(eq(messages.senderId, userId));
    const received = await db.select({ partnerId: messages.senderId })
      .from(messages).where(eq(messages.receiverId, userId));

    const partnerIds = Array.from(new Set([...sent.map(s => s.partnerId), ...received.map(r => r.partnerId)]));

    const conversations = [];
    for (const partnerId of partnerIds) {
      const partner = await this.getUser(partnerId);
      if (!partner) continue;

      const lastMsgs = await db.select()
        .from(messages)
        .where(or(
          and(eq(messages.senderId, userId), eq(messages.receiverId, partnerId)),
          and(eq(messages.senderId, partnerId), eq(messages.receiverId, userId))
        ))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const unreadMsgs = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.senderId, partnerId),
          eq(messages.receiverId, userId),
          eq(messages.isRead, false)
        ));

      conversations.push({
        userId: partnerId,
        name: partner.name,
        lastMessage: lastMsgs[0]?.content || "",
        unread: Number(unreadMsgs[0]?.count || 0),
      });
    }
    return conversations;
  }

  async markMessagesRead(senderId: number, receiverId: number): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.senderId, senderId), eq(messages.receiverId, receiverId)));
  }

  // === Interventions ===
  async createIntervention(intervention: Omit<Intervention, "id" | "createdAt">): Promise<Intervention> {
    const [newIntervention] = await db.insert(interventions).values(intervention).returning();
    return newIntervention;
  }

  async getInterventions(studentId: number): Promise<Intervention[]> {
    return await db.select()
      .from(interventions)
      .where(eq(interventions.studentId, studentId))
      .orderBy(desc(interventions.createdAt));
  }

  // === Achievements ===
  async createAchievement(achievement: Omit<Achievement, "id" | "earnedAt">): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements).values(achievement).returning();
    return newAchievement;
  }

  async getAchievements(studentId: number): Promise<Achievement[]> {
    return await db.select()
      .from(achievements)
      .where(eq(achievements.studentId, studentId))
      .orderBy(desc(achievements.earnedAt));
  }

  async hasAchievement(studentId: number, type: string): Promise<boolean> {
    const [existing] = await db.select()
      .from(achievements)
      .where(and(eq(achievements.studentId, studentId), eq(achievements.type, type)))
      .limit(1);
    return !!existing;
  }

  // === Study Sessions ===
  async createStudySession(session: Omit<StudySession, "id" | "completedAt">): Promise<StudySession> {
    const [newSession] = await db.insert(studySessions).values(session).returning();
    return newSession;
  }

  async getStudySessions(studentId: number, limit = 50): Promise<StudySession[]> {
    return await db.select()
      .from(studySessions)
      .where(eq(studySessions.studentId, studentId))
      .orderBy(desc(studySessions.completedAt))
      .limit(limit);
  }

  async getTotalStudyMinutes(studentId: number): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${studySessions.duration}), 0)` })
      .from(studySessions)
      .where(eq(studySessions.studentId, studentId));
    return Number(result[0]?.total || 0);
  }

  // === Goals ===
  async createGoal(goal: Omit<Goal, "id" | "isCompleted" | "createdAt">): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async getGoals(studentId: number): Promise<Goal[]> {
    return await db.select()
      .from(goals)
      .where(eq(goals.studentId, studentId))
      .orderBy(desc(goals.createdAt));
  }

  async updateGoal(goalId: number, updates: Partial<Goal>): Promise<Goal> {
    const [updated] = await db.update(goals)
      .set(updates)
      .where(eq(goals.id, goalId))
      .returning();
    return updated;
  }

  async deleteGoal(goalId: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, goalId));
  }

  // === Notifications ===
  async createNotification(notification: Omit<Notification, "id" | "isRead" | "createdAt">): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  // === Benchmarking ===
  async getClassBenchmark(teacherId: number): Promise<{ avgCgpa: number; avgAttendance: number; avgStress: number; totalStudents: number }> {
    const studentList = await this.getStudentsByTeacher(teacherId);
    if (studentList.length === 0) return { avgCgpa: 0, avgAttendance: 0, avgStress: 0, totalStudents: 0 };

    let totalCgpa = 0, totalAttendance = 0, totalStress = 0;
    let cgpaCount = 0, attendanceCount = 0, stressCount = 0;

    for (const s of studentList) {
      const academic = await this.getAcademicRecord(s.id);
      if (academic) {
        totalCgpa += parseFloat(academic.cgpa as string);
        totalAttendance += parseFloat(academic.attendancePercentage as string);
        cgpaCount++;
        attendanceCount++;
      }
      const stress = await this.getLatestStressRecord(s.id);
      if (stress) {
        totalStress += stress.stressScore;
        stressCount++;
      }
    }

    return {
      avgCgpa: cgpaCount > 0 ? totalCgpa / cgpaCount : 0,
      avgAttendance: attendanceCount > 0 ? totalAttendance / attendanceCount : 0,
      avgStress: stressCount > 0 ? totalStress / stressCount : 0,
      totalStudents: studentList.length,
    };
  }

  // ASVS 8.3.2 – Delete all data associated with a user
  async deleteAllUserData(userId: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(goals).where(eq(goals.studentId, userId));
    await db.delete(studySessions).where(eq(studySessions.studentId, userId));
    await db.delete(achievements).where(eq(achievements.studentId, userId));
    await db.delete(interventions).where(eq(interventions.studentId, userId));
    await db.delete(messages).where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)));
    await db.delete(moodEntries).where(eq(moodEntries.studentId, userId));
    await db.delete(predictions).where(eq(predictions.studentId, userId));
    await db.delete(stressRecords).where(eq(stressRecords.studentId, userId));
    await db.delete(semesterRecords).where(eq(semesterRecords.studentId, userId));
    await db.delete(academicRecords).where(eq(academicRecords.studentId, userId));
    await db.delete(students).where(eq(students.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
