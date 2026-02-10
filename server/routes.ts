import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// Simple heuristic risk engine (Random Forest simulation)
function calculateRisk(academic: any, stress: any) {
  let riskScore = 0.0;
  let factors = [];

  // 1. Academic Factors (Weight: 60%)
  if (academic) {
    const attendance = parseFloat(academic.attendancePercentage);
    const cgpa = parseFloat(academic.cgpa);
    const backlogs = academic.backlogs || 0;

    if (attendance < 75) {
      riskScore += 0.3;
      factors.push("Low Attendance");
    } else if (attendance < 85) {
      riskScore += 0.1;
    }

    if (cgpa < 5.0) {
      riskScore += 0.3;
      factors.push("Low CGPA");
    } else if (cgpa < 7.0) {
      riskScore += 0.1;
    }

    if (backlogs > 0) {
      riskScore += 0.2;
      factors.push("Has Backlogs");
    }
  } else {
    // No academic data is a risk in itself
    riskScore += 0.2;
    factors.push("Missing Academic Data");
  }

  // 2. Stress Factors (Weight: 40%)
  if (stress) {
    const stressScore = stress.stressScore; // 0-100
    if (stressScore > 70) {
      riskScore += 0.3;
      factors.push("High Stress Level");
    } else if (stressScore > 40) {
      riskScore += 0.1;
    }
  }

  // Cap risk score
  riskScore = Math.min(riskScore, 1.0);

  let riskLevel = "Low";
  if (riskScore > 0.7) riskLevel = "Critical";
  else if (riskScore > 0.5) riskLevel = "High";
  else if (riskScore > 0.3) riskLevel = "Moderate";

  return { riskScore, riskLevel, factors };
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Auth
  setupAuth(app);

  // Seed Data (if empty)
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

    // Link Alice
    await storage.createStudentInvite({
      email: "alice@school.edu",
      teacherId: teacher.id,
      isRegistered: true,
      userId: aliceUser.id
    });

    // Create another invite (Bob)
    await storage.createStudentInvite({
      email: "bob@school.edu",
      teacherId: teacher.id,
      isRegistered: false,
    });

    // Add Data for Alice
    await storage.updateAcademicRecord({
      studentId: aliceUser.id,
      attendancePercentage: "82.5",
      cgpa: "7.8",
      backlogs: 0,
      studyHoursPerDay: 4,
    });

    const stressRec = await storage.createStressRecord({
      studentId: aliceUser.id,
      answers: { q1: 3, q2: 4 },
      stressScore: 65,
    });
    
    // Initial Prediction
    await storage.createPrediction({
      studentId: aliceUser.id,
      riskScore: "0.45",
      riskLevel: "Moderate",
      factors: ["High Stress Level"],
    });

    console.log("Seeding complete!");
  }


  // === Teacher Routes ===

  app.get(api.teacher.listStudents.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "teacher") {
      return res.status(401).send("Unauthorized");
    }

    const students = await storage.getStudentsByTeacher(req.user!.id);
    const enrichedStudents = await Promise.all(students.map(async (s) => {
      const pred = await storage.getLatestPrediction(s.id);
      return {
        ...s,
        riskLevel: pred?.riskLevel || "Unknown",
        riskScore: pred ? parseFloat(pred.riskScore as string) : 0,
      };
    }));

    res.json(enrichedStudents);
  });

  app.post(api.teacher.addStudent.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "teacher") {
      return res.status(401).send("Unauthorized");
    }

    const input = api.teacher.addStudent.input.parse(req.body);
    
    // Check if student exists
    const existing = await storage.getStudentByEmail(input.email);
    if (existing) {
      return res.status(400).json({ message: "Student already invited/registered" });
    }

    const student = await storage.createStudentInvite({
      email: input.email,
      teacherId: req.user!.id,
    });

    res.status(201).json(student);
  });

  // === Student Routes ===

  app.get(api.student.getDashboard.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "student") {
      return res.status(401).send("Unauthorized");
    }

    const userId = req.user!.id;
    const academic = await storage.getAcademicRecord(userId);
    const latestStress = await storage.getLatestStressRecord(userId);
    const prediction = await storage.getLatestPrediction(userId);
    const stressHistory = await storage.getAllStressRecords(userId);
    const academicHistory = await storage.getAllAcademicRecords(userId);

    res.json({
      student: req.user!,
      academic: academic || null,
      latestStress: latestStress || null,
      prediction: prediction || null,
      history: {
        stress: stressHistory,
        academic: academicHistory,
      },
    });
  });

  app.post(api.student.updateAcademic.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "student") {
      return res.status(401).send("Unauthorized");
    }

    const input = api.student.updateAcademic.input.parse(req.body);
    const userId = req.user!.id;

    const record = await storage.updateAcademicRecord({
      ...input,
      studentId: userId,
    });

    // Trigger Risk Calculation
    const stress = await storage.getLatestStressRecord(userId);
    const risk = calculateRisk(record, stress);
    await storage.createPrediction({
      studentId: userId,
      riskScore: risk.riskScore.toString(),
      riskLevel: risk.riskLevel as "Low" | "Moderate" | "High" | "Critical",
      factors: risk.factors,
    });

    res.json(record);
  });

  app.post(api.student.submitStress.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "student") {
      return res.status(401).send("Unauthorized");
    }

    const input = api.student.submitStress.input.parse(req.body);
    const userId = req.user!.id;

    // Calculate simple stress score from answers (avg of 1-5 scale)
    const scores = Object.values(input.answers);
    const total = scores.reduce((a, b) => a + b, 0);
    const avg = total / scores.length; 
    // Normalize 1-5 to 0-100. (Avg-1) * 25
    const stressScore = Math.round((avg - 1) * 25);

    const record = await storage.createStressRecord({
      studentId: userId,
      answers: input.answers,
      stressScore,
    });

    // Trigger Risk Calculation
    const academic = await storage.getAcademicRecord(userId);
    const risk = calculateRisk(academic, record);
    await storage.createPrediction({
      studentId: userId,
      riskScore: risk.riskScore.toString(),
      riskLevel: risk.riskLevel as "Low" | "Moderate" | "High" | "Critical",
      factors: risk.factors,
    });

    res.status(201).json(record);
  });

  return httpServer;
}
