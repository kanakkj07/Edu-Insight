import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { securityLog } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { User } from "@shared/schema";
import rateLimit from "express-rate-limit";

/* =========================================================
   ASVS 8.1.4 – Abnormal Request Detection
========================================================= */
const failedRequestCounts = new Map<string, { count: number; firstSeen: number }>();
const ABNORMAL_THRESHOLD = 20;
const ABNORMAL_WINDOW = 5 * 60 * 1000;

function trackFailedRequest(ip: string) {
  const now = Date.now();
  const entry = failedRequestCounts.get(ip) || { count: 0, firstSeen: now };
  if (now - entry.firstSeen > ABNORMAL_WINDOW) {
    entry.count = 1;
    entry.firstSeen = now;
  } else {
    entry.count++;
  }
  failedRequestCounts.set(ip, entry);
  if (entry.count >= ABNORMAL_THRESHOLD) {
    securityLog("ABNORMAL_ACTIVITY_DETECTED", { ip, failedRequests: entry.count });
  }
}

const dataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many data requests, please try again in a minute" },
});

// Risk engine
function calculateRisk(academic: any, stress: any, semesters: any[] = []) {
  let riskScore = 0.0;
  let factors: string[] = [];

  if (academic) {
    const attendance = parseFloat(academic.attendancePercentage);
    const backlogs = academic.backlogs || 0;

    if (attendance < 75) {
      riskScore += 0.3;
      factors.push("Low Attendance");
    } else if (attendance < 85) {
      riskScore += 0.1;
    }

    if (backlogs > 0) {
      riskScore += 0.2;
      factors.push("Has Backlogs");
    }

    if (semesters && semesters.length > 0) {
      const sorted = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);
      const latest = sorted[sorted.length - 1];
      const latestCgpa = parseFloat(latest.cgpa);

      if (latestCgpa < 5.0) {
        riskScore += 0.3;
        factors.push("Low CGPA");
      } else if (latestCgpa < 7.0) {
        riskScore += 0.1;
      }

      if (sorted.length > 1) {
        const previous = sorted[sorted.length - 2];
        const drop = parseFloat(previous.cgpa) - latestCgpa;
        if (drop >= 1.0) {
          riskScore += 0.2;
          factors.push(`Sudden drop in performance (${drop.toFixed(1)} points)`);
        } else if (drop <= -0.5) {
          riskScore = Math.max(0, riskScore - 0.1);
        }
      }
      
      const lowCount = sorted.filter(s => parseFloat(s.cgpa) < 6.0).length;
      if (lowCount >= 3) {
        riskScore += 0.2;
        factors.push("Consistent low CGPA");
      }
    } else {
      const cgpa = parseFloat(academic.cgpa);
      if (cgpa < 5.0) {
        riskScore += 0.3;
        factors.push("Low CGPA");
      } else if (cgpa < 7.0) {
        riskScore += 0.1;
      }
    }
  } else {
    riskScore += 0.2;
    factors.push("Missing Academic Data");
  }

  if (stress) {
    const stressScore = stress.stressScore;
    if (stressScore > 70) {
      riskScore += 0.3;
      factors.push("High Stress Level");
    } else if (stressScore > 40) {
      riskScore += 0.1;
    }
  }

  riskScore = Math.min(riskScore, 1.0);

  let riskLevel = "Low";
  if (riskScore > 0.7) riskLevel = "Critical";
  else if (riskScore > 0.5) riskLevel = "High";
  else if (riskScore > 0.3) riskLevel = "Moderate";

  return { riskScore, riskLevel, factors };
}

// F1: AI Recommendations Engine
function generateRecommendations(academic: any, stress: any, semesters: any[], riskLevel: string): string[] {
  const recs: string[] = [];

  if (!academic) {
    recs.push("📝 Start by updating your academic records so we can provide personalized recommendations.");
    return recs;
  }

  const attendance = parseFloat(academic.attendancePercentage || "0");
  const cgpa = parseFloat(academic.cgpa || "0");
  const backlogs = academic.backlogs || 0;
  const studyHours = academic.studyHoursPerDay || 0;

  // Attendance recommendations
  if (attendance < 75) {
    const needed = Math.ceil((75 - attendance) / 2);
    recs.push(`📅 Your attendance is ${attendance}%. Attending ${needed} more classes this week could boost you above 75%, reducing risk significantly.`);
  } else if (attendance < 85) {
    recs.push(`📅 Attendance is ${attendance}% — good, but pushing above 85% would lower your risk to the next tier.`);
  }

  // CGPA recommendations
  if (semesters.length > 1) {
    const sorted = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);
    const latest = parseFloat(sorted[sorted.length - 1].cgpa);
    const prev = parseFloat(sorted[sorted.length - 2].cgpa);
    if (latest < prev) {
      recs.push(`📉 Your CGPA dropped from ${prev.toFixed(1)} to ${latest.toFixed(1)}. Consider seeking help in weaker subjects before this becomes a trend.`);
    } else if (latest > prev) {
      recs.push(`📈 Great improvement! CGPA went from ${prev.toFixed(1)} to ${latest.toFixed(1)}. Keep up this momentum.`);
    }
  }
  if (cgpa < 6.0) {
    recs.push(`📚 Your average CGPA is ${cgpa.toFixed(1)}. Focus on clearing fundamentals — even a 0.5 improvement significantly reduces your risk.`);
  }

  // Backlogs
  if (backlogs > 0) {
    recs.push(`⚠️ You have ${backlogs} backlog(s). Clearing even one backlog reduces your risk score by ~20%.`);
  }

  // Study hours
  if (studyHours < 3) {
    recs.push(`⏰ You study ${studyHours} hrs/day. Research shows 3-4 hours of focused study daily leads to measurable GPA improvement.`);
  }

  // Stress
  if (stress && stress.stressScore > 70) {
    recs.push(`🧘 Your stress score is ${stress.stressScore}/100, which is high. Try the De-Stress Zone breathing exercises or consider speaking with a counselor.`);
  } else if (stress && stress.stressScore > 40) {
    recs.push(`💡 Moderate stress detected (${stress.stressScore}/100). Regular breaks and the Pomodoro technique can help manage workload better.`);
  }

  // General advice based on risk level
  if (riskLevel === "Critical") {
    recs.push("🚨 You're at Critical risk. We strongly recommend scheduling a meeting with your academic advisor.");
  } else if (riskLevel === "Low") {
    recs.push("✅ You're doing great! Keep maintaining your current habits and set stretch goals to stay motivated.");
  }

  return recs;
}

// F4: What-If Simulator
function simulateRisk(params: { attendance: number; cgpa: number; backlogs: number; stressScore: number }): { riskScore: number; riskLevel: string; factors: string[] } {
  const academic = {
    attendancePercentage: params.attendance.toString(),
    cgpa: params.cgpa.toString(),
    backlogs: params.backlogs,
    studyHoursPerDay: 4,
  };
  const stress = { stressScore: params.stressScore };
  const semesters = [{ semesterNumber: 1, cgpa: params.cgpa.toString() }];
  return calculateRisk(academic, stress, semesters);
}

// Achievement checker
async function checkAndAwardAchievements(userId: number) {
  // Check mood streak
  const moods = await storage.getMoodEntries(userId, 7);
  if (moods.length >= 7 && !(await storage.hasAchievement(userId, "mood_streak_7"))) {
    await storage.createAchievement({
      studentId: userId,
      type: "mood_streak_7",
      title: "Mood Master",
      description: "Logged mood for 7 days",
      icon: "🌟",
    });
    await storage.createNotification({
      userId,
      title: "Achievement Unlocked!",
      message: "You earned 'Mood Master' for 7 days of mood tracking!",
      type: "achievement",
      link: "/student-dashboard",
    });
  }

  // Study milestone
  const totalMinutes = await storage.getTotalStudyMinutes(userId);
  if (totalMinutes >= 600 && !(await storage.hasAchievement(userId, "study_10hrs"))) {
    await storage.createAchievement({
      studentId: userId,
      type: "study_10hrs",
      title: "Study Champion",
      description: "Completed 10+ hours of tracked study",
      icon: "📚",
    });
  }

  if (totalMinutes >= 3000 && !(await storage.hasAchievement(userId, "study_50hrs"))) {
    await storage.createAchievement({
      studentId: userId,
      type: "study_50hrs",
      title: "Knowledge Seeker",
      description: "Completed 50+ hours of tracked study",
      icon: "🎓",
    });
  }

  // First stress assessment
  const stressRecords = await storage.getAllStressRecords(userId);
  if (stressRecords.length >= 1 && !(await storage.hasAchievement(userId, "first_stress"))) {
    await storage.createAchievement({
      studentId: userId,
      type: "first_stress",
      title: "Self-Aware",
      description: "Completed your first stress assessment",
      icon: "🧠",
    });
  }

  // CGPA improvement
  const semesters = await storage.getSemesterRecords(userId);
  if (semesters.length >= 2) {
    const sorted = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);
    const last = parseFloat(sorted[sorted.length - 1].cgpa as string);
    const prev = parseFloat(sorted[sorted.length - 2].cgpa as string);
    if (last > prev + 0.5 && !(await storage.hasAchievement(userId, "cgpa_improved"))) {
      await storage.createAchievement({
        studentId: userId,
        type: "cgpa_improved",
        title: "Rising Star",
        description: "Improved CGPA by 0.5+ points between semesters",
        icon: "⭐",
      });
    }
  }
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Seed Data
  if ((await storage.getUserByEmail("teacher@school.edu")) === undefined) {
    console.log("Seeding database...");
    const teacherPassword = await hashPassword("password");
    const teacher = await storage.createUser({
      email: "teacher@school.edu",
      password: teacherPassword,
      role: "teacher",
      name: "Dr. Smith",
    });

    const studentPassword = await hashPassword("password");
    const aliceUser = await storage.createUser({
      email: "alice@school.edu",
      password: studentPassword,
      role: "student",
      name: "Alice Student",
    });

    await storage.createStudentInvite({
      email: "alice@school.edu",
      teacherId: teacher.id,
      isRegistered: true,
      userId: aliceUser.id
    } as any);

    await storage.createStudentInvite({
      email: "bob@school.edu",
      teacherId: teacher.id,
    } as any);

    await storage.updateAcademicRecord({
      studentId: aliceUser.id,
      attendancePercentage: 82.5,
      cgpa: 7.8,
      backlogs: 0,
      studyHoursPerDay: 4,
    } as any);

    await storage.createStressRecord({
      studentId: aliceUser.id,
      answers: { q1: 3, q2: 4 },
      stressScore: 65,
    });
    
    await storage.createPrediction({
      studentId: aliceUser.id,
      riskScore: "0.45",
      riskLevel: "Moderate",
      factors: ["High Stress Level"],
    });

    console.log("Seeding complete!");
  }


  // === Teacher Routes ===

  app.get(api.teacher.listStudents.path, dataLimiter, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!req.isAuthenticated() || user.role !== "teacher") {
        trackFailedRequest(req.ip || "unknown");
        securityLog("ACCESS_DENIED", { path: req.path, ip: req.ip });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const students = await storage.getStudentsByTeacher(user.id);
      const enrichedStudents = await Promise.all(students.map(async (s) => {
        const pred = await storage.getLatestPrediction(s.id);
        return {
          ...s,
          riskLevel: pred?.riskLevel || "Unknown",
          riskScore: pred ? parseFloat(pred.riskScore as string) : 0,
        };
      }));

      res.json(enrichedStudents);
    } catch (err) {
      securityLog("ROUTE_ERROR", { path: req.path, error: (err as Error).message });
      next(err);
    }
  });

  app.post(api.teacher.addStudent.path, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!req.isAuthenticated() || user.role !== "teacher") {
        trackFailedRequest(req.ip || "unknown");
        securityLog("ACCESS_DENIED", { path: req.path, ip: req.ip });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input = api.teacher.addStudent.input.parse(req.body);
      
      const existing = await storage.getStudentByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Student already invited/registered" });
      }

      const student = await storage.createStudentInvite({
        email: input.email,
        teacherId: user.id,
      } as any);

      res.status(201).json(student);
    } catch (err) {
      securityLog("ROUTE_ERROR", { path: req.path, error: (err as Error).message });
      next(err);
    }
  });

  // === Student Dashboard (enhanced) ===
  app.get(api.student.getDashboard.path, dataLimiter, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!req.isAuthenticated() || user.role !== "student") {
        trackFailedRequest(req.ip || "unknown");
        securityLog("ACCESS_DENIED", { path: req.path, ip: req.ip });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = user.id;
      const academic = await storage.getAcademicRecord(userId);
      const latestStress = await storage.getLatestStressRecord(userId);
      const prediction = await storage.getLatestPrediction(userId);
      const stressHistory = await storage.getAllStressRecords(userId);
      const academicHistory = await storage.getAllAcademicRecords(userId);
      const semesterRecords = await storage.getSemesterRecords(userId);
      const moodEntriesData = await storage.getMoodEntries(userId);
      const achievementsData = await storage.getAchievements(userId);
      const studySessionsData = await storage.getStudySessions(userId);
      const goalsData = await storage.getGoals(userId);
      const notificationsData = await storage.getNotifications(userId);

      // F1: Generate recommendations
      const recommendations = generateRecommendations(
        academic, latestStress, semesterRecords,
        prediction?.riskLevel || "Unknown"
      );

      res.json({
        student: req.user!,
        academic: academic || null,
        latestStress: latestStress || null,
        prediction: prediction || null,
        semesterRecords,
        moodEntries: moodEntriesData,
        achievements: achievementsData,
        studySessions: studySessionsData,
        goals: goalsData,
        recommendations,
        notifications: notificationsData,
        history: {
          stress: stressHistory,
          academic: academicHistory,
          semesters: semesterRecords,
        },
      });
    } catch (err) {
      securityLog("ROUTE_ERROR", { path: req.path, error: (err as Error).message });
      next(err);
    }
  });

  app.post(api.student.updateAcademic.path, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!req.isAuthenticated() || user.role !== "student") {
        trackFailedRequest(req.ip || "unknown");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input = api.student.updateAcademic.input.parse(req.body);
      const userId = user.id;

      let calculatedCgpa = input.cgpa || 0;
      if (input.cgpas && input.cgpas.length > 0) {
        const sum = input.cgpas.reduce((acc: number, val: any) => acc + Number(val.cgpa), 0);
        calculatedCgpa = sum / input.cgpas.length;
      }

      const record = await storage.updateAcademicRecord({
        ...input,
        cgpa: calculatedCgpa,
        studentId: userId,
      });
      
      let semesterRecordsResult: any[] = [];
      if (input.cgpas && input.cgpas.length > 0) {
        semesterRecordsResult = await storage.updateSemesterRecords(userId, record.id, input.cgpas);
      }

      const stress = await storage.getLatestStressRecord(userId);
      const risk = calculateRisk(record, stress, semesterRecordsResult);
      await storage.createPrediction({
        studentId: userId,
        riskScore: risk.riskScore.toString(),
        riskLevel: risk.riskLevel as "Low" | "Moderate" | "High" | "Critical",
        factors: risk.factors,
      });

      // Check achievements
      await checkAndAwardAchievements(userId);

      res.json(record);
    } catch (err) {
      securityLog("ROUTE_ERROR", { path: req.path, error: (err as Error).message });
      next(err);
    }
  });

  app.post(api.student.submitStress.path, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!req.isAuthenticated() || user.role !== "student") {
        trackFailedRequest(req.ip || "unknown");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input = api.student.submitStress.input.parse(req.body);
      const userId = user.id;

      const scores = Object.values(input.answers);
      const total = scores.reduce((a, b) => a + b, 0);
      const avg = total / scores.length; 
      const stressScore = Math.round((avg - 1) * 25);

      const record = await storage.createStressRecord({
        studentId: userId,
        answers: input.answers,
        stressScore,
      });

      const academic = await storage.getAcademicRecord(userId);
      const semesters = await storage.getSemesterRecords(userId);
      const risk = calculateRisk(academic, record, semesters);
      await storage.createPrediction({
        studentId: userId,
        riskScore: risk.riskScore.toString(),
        riskLevel: risk.riskLevel as "Low" | "Moderate" | "High" | "Critical",
        factors: risk.factors,
      });

      await checkAndAwardAchievements(userId);

      res.status(201).json(record);
    } catch (err) {
      securityLog("ROUTE_ERROR", { path: req.path, error: (err as Error).message });
      next(err);
    }
  });

  // === F4: What-If Simulator ===
  app.post("/api/student/simulate", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        attendance: z.coerce.number().min(0).max(100),
        cgpa: z.coerce.number().min(0).max(10),
        backlogs: z.coerce.number().int().min(0),
        stressScore: z.coerce.number().int().min(0).max(100),
      });
      const params = schema.parse(req.body);
      const result = simulateRisk(params);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // === F5: Mood Journal ===
  app.post("/api/student/mood", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        mood: z.coerce.number().int().min(1).max(5),
        note: z.string().max(500).optional(),
      });
      const input = schema.parse(req.body);
      const entry = await storage.createMoodEntry({
        studentId: (req.user as User).id,
        mood: input.mood,
        note: input.note || null,
      });
      await checkAndAwardAchievements((req.user as User).id);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/student/moods", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const entries = await storage.getMoodEntries((req.user as User).id);
      res.json(entries);
    } catch (err) {
      next(err);
    }
  });

  // === F6: Messages ===
  app.post("/api/messages", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const schema = z.object({
        receiverId: z.coerce.number(),
        content: z.string().min(1).max(2000),
      });
      const input = schema.parse(req.body);
      const msg = await storage.createMessage({
        senderId: (req.user as User).id,
        receiverId: input.receiverId,
        content: input.content,
      });

      // Notify receiver  
      await storage.createNotification({
        userId: input.receiverId,
        title: "New Message",
        message: `${(req.user as User).name} sent you a message`,
        type: "message",
        link: "/student-dashboard",
      });

      res.status(201).json(msg);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/messages/:partnerId", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const partnerId = parseInt(req.params.partnerId as string);
      const userId = (req.user as User).id;
      const msgs = await storage.getMessages(userId, partnerId);
      await storage.markMessagesRead(partnerId, userId);
      res.json(msgs);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/conversations", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const convos = await storage.getConversations((req.user as User).id);
      res.json(convos);
    } catch (err) {
      next(err);
    }
  });

  // === F6: Interventions ===
  app.post("/api/teacher/interventions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "teacher") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        studentId: z.coerce.number(),
        type: z.enum(["counseling", "parent_contact", "academic_support", "referral", "other"]),
        notes: z.string().max(1000).optional(),
        outcome: z.string().max(500).optional(),
      });
      const input = schema.parse(req.body);
      const intervention = await storage.createIntervention({
        teacherId: (req.user as User).id,
        ...input,
        notes: input.notes || null,
        outcome: input.outcome || null,
      });
      res.status(201).json(intervention);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/teacher/interventions/:studentId", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "teacher") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const studentId = parseInt(req.params.studentId as string);
      const records = await storage.getInterventions(studentId);
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  // === F7: Study Sessions ===
  app.post("/api/student/study-session", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        duration: z.coerce.number().int().min(1).max(600),
        subject: z.string().max(100).optional(),
      });
      const input = schema.parse(req.body);
      const session = await storage.createStudySession({
        studentId: (req.user as User).id,
        duration: input.duration,
        subject: input.subject || null,
      });
      await checkAndAwardAchievements((req.user as User).id);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/student/study-sessions", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const sessions = await storage.getStudySessions((req.user as User).id);
      const totalMinutes = await storage.getTotalStudyMinutes((req.user as User).id);
      res.json({ sessions, totalMinutes });
    } catch (err) {
      next(err);
    }
  });

  // === F9: Goals ===
  app.post("/api/student/goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const schema = z.object({
        title: z.string().min(1).max(200),
        target: z.coerce.number().min(0).optional(),
        type: z.enum(["cgpa", "attendance", "study_hours", "stress_reduction", "custom"]),
        deadline: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const goal = await storage.createGoal({
        studentId: (req.user as User).id,
        title: input.title,
        target: input.target?.toString() || null,
        current: "0",
        type: input.type,
        deadline: input.deadline ? new Date(input.deadline) : null,
      });
      res.status(201).json(goal);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/student/goals", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const goalsList = await storage.getGoals((req.user as User).id);
      res.json(goalsList);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/student/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const goalId = parseInt(req.params.id);
      const schema = z.object({
        current: z.coerce.number().min(0).optional(),
        isCompleted: z.boolean().optional(),
      });
      const input = schema.parse(req.body);
      const updates: any = {};
      if (input.current !== undefined) updates.current = input.current.toString();
      if (input.isCompleted !== undefined) updates.isCompleted = input.isCompleted;
      const goal = await storage.updateGoal(goalId, updates);
      res.json(goal);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/student/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const goalId = parseInt(req.params.id);
      await storage.deleteGoal(goalId);
      res.status(200).json({ message: "Goal deleted" });
    } catch (err) {
      next(err);
    }
  });

  // === F3: Notifications ===
  app.get("/api/notifications", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const notifs = await storage.getNotifications((req.user as User).id);
      const unreadCount = await storage.getUnreadCount((req.user as User).id);
      res.json({ notifications: notifs, unreadCount });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/notifications/:id/read", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      await storage.markNotificationRead(parseInt(req.params.id));
      res.status(200).json({ message: "Marked as read" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/notifications/read-all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      await storage.markAllNotificationsRead((req.user as User).id);
      res.status(200).json({ message: "All marked as read" });
    } catch (err) {
      next(err);
    }
  });

  // === F2: Peer Benchmarking ===
  app.get("/api/student/benchmark", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = (req.user as User).id;
      // Find the student's teacher
      const studentRecord = await storage.getStudentByEmail((req.user as User).email);
      if (!studentRecord?.teacherId) {
        return res.json({ available: false });
      }
      const benchmark = await storage.getClassBenchmark(studentRecord.teacherId);
      const academic = await storage.getAcademicRecord(userId);
      const stress = await storage.getLatestStressRecord(userId);

      res.json({
        available: true,
        class: benchmark,
        you: {
          cgpa: academic ? parseFloat(academic.cgpa as string) : 0,
          attendance: academic ? parseFloat(academic.attendancePercentage as string) : 0,
          stress: stress?.stressScore || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // === F8: Teacher Benchmark / Admin ===
  app.get("/api/teacher/benchmark", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "teacher") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const benchmark = await storage.getClassBenchmark((req.user as User).id);
      res.json(benchmark);
    } catch (err) {
      next(err);
    }
  });

  // === Teacher: view student detail ===
  app.get("/api/teacher/students/:studentId", dataLimiter, async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "teacher") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const studentId = parseInt(req.params.studentId as string);
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });

      const academic = await storage.getAcademicRecord(studentId);
      const latestStress = await storage.getLatestStressRecord(studentId);
      const prediction = await storage.getLatestPrediction(studentId);
      const semesters = await storage.getSemesterRecords(studentId);
      const interventionsList = await storage.getInterventions(studentId);

      res.json({
        student: { id: student.id, name: student.name, email: student.email },
        academic,
        latestStress,
        prediction,
        semesters,
        interventions: interventionsList,
      });
    } catch (err) {
      next(err);
    }
  });

  /* =========================================================
     ASVS 8.3.2 – User Data Export
  ========================================================= */
  app.get("/api/student/export-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = (req.user as User).id;
      const academic = await storage.getAcademicRecord(userId);
      const stressHistory = await storage.getAllStressRecords(userId);
      const semesterRecordsData = await storage.getSemesterRecords(userId);
      const predictionsData = await storage.getLatestPrediction(userId);
      const moodsData = await storage.getMoodEntries(userId);
      const studyData = await storage.getStudySessions(userId);
      const achievementsData = await storage.getAchievements(userId);
      const goalsData = await storage.getGoals(userId);

      securityLog("DATA_EXPORT", { userId });
      res.json({
        user: { id: userId, email: (req.user as User).email, name: (req.user as User).name },
        academic,
        stressHistory,
        semesterRecords: semesterRecordsData,
        latestPrediction: predictionsData,
        moodEntries: moodsData,
        studySessions: studyData,
        achievements: achievementsData,
        goals: goalsData,
        exportedAt: new Date().toISOString(),
        retentionPolicy: "Data is retained for the duration of enrollment. Contact admin for deletion.",
      });
    } catch (err) {
      next(err);
    }
  });

  /* =========================================================
     ASVS 8.3.2 – User Data Deletion
  ========================================================= */
  app.delete("/api/student/delete-account", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || (req.user as User).role !== "student") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = (req.user as User).id;
      securityLog("ACCOUNT_DELETION_REQUESTED", { userId });

      await storage.deleteAllUserData(userId);

      req.logout((err) => {
        if (err) return next(err);
        req.session.destroy((err2) => {
          if (err2) return next(err2);
          res.clearCookie("sessionId");
          securityLog("ACCOUNT_DELETED", { userId });
          res.status(200).json({ message: "Account and all associated data deleted successfully" });
        });
      });
    } catch (err) {
      next(err);
    }
  });

  return httpServer;
}
