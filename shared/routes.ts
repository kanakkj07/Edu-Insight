import { z } from 'zod';
import { insertUserSchema, insertStudentSchema, insertAcademicSchema, users, students, academicRecords, stressRecords, predictions } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  teacher: {
    // List all students for the logged-in teacher
    listStudents: {
      method: 'GET' as const,
      path: '/api/teacher/students' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect & {
          riskLevel?: string;
          riskScore?: number;
          lastUpdated?: string;
        }>()),
      },
    },
    // Invite/Add a new student
    addStudent: {
      method: 'POST' as const,
      path: '/api/teacher/students' as const,
      input: insertStudentSchema.pick({ email: true }),
      responses: {
        201: z.custom<typeof students.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  student: {
    // Get dashboard data for logged-in student
    getDashboard: {
      method: 'GET' as const,
      path: '/api/student/dashboard' as const,
      responses: {
        200: z.object({
          student: z.custom<typeof users.$inferSelect>(),
          academic: z.custom<typeof academicRecords.$inferSelect>().nullable(),
          latestStress: z.custom<typeof stressRecords.$inferSelect>().nullable(),
          prediction: z.custom<typeof predictions.$inferSelect>().nullable(),
          history: z.object({
            stress: z.array(z.custom<typeof stressRecords.$inferSelect>()),
            academic: z.array(z.custom<typeof academicRecords.$inferSelect>()),
          }),
        }),
      },
    },
    // Update academic records
    updateAcademic: {
      method: 'POST' as const,
      path: '/api/student/academic' as const,
      input: insertAcademicSchema.omit({ studentId: true }),
      responses: {
        200: z.custom<typeof academicRecords.$inferSelect>(),
      },
    },
    // Submit stress questionnaire
    submitStress: {
      method: 'POST' as const,
      path: '/api/student/stress' as const,
      input: z.object({
        answers: z.record(z.string(), z.number()), // Question ID -> Score (1-5)
      }),
      responses: {
        201: z.custom<typeof stressRecords.$inferSelect>(),
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
