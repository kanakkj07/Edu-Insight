# Edu-Insight — Predictive AI Platform for Student Success (v2.0.0)

A comprehensive SaaS platform built to preemptively identify at-risk students and support them toward academic success with built-in wellness and productivity tools.

![Edu-Insight](https://img.shields.io/badge/End--Insight-v2.0.0-2563eb?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-000?style=flat-square&logo=react)
![Express](https://img.shields.io/badge/Express-5.0-009688?style=flat-square&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-7C3AED?style=flat-square)

## Updates

All updates from v1.0.0 onwards are documented in [UPDATES.md](UPDATES.md).

Refer to it for the latest changes!

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                    │
│      React 18 + Vite + TypeScript + Tailwind + shadcn/ui    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Student Dash │ │ Teacher Dash │ │   Landing    │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│              ▲ REST API / WebSocket (real-time) ▲           │
├──────────────┼─────────────────────┼────────────────────────┤
│              │    APPLICATION LAYER│                        │
│  ┌───────────▼─────────────────────▼────────────┐           │
│  │           Node.js & Express API              │           │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐│           │
│  │  │ Auth & Auth│ │ Predict ML │ │ Messaging  ││           │
│  │  │ (Passport) │ │ (RF Model) │ │ (WebSocket)││           │
│  │  └────────────┘ └────────────┘ └────────────┘│           │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐│           │
│  │  │ Intervent. │ │  Wellness  │ │ Goals & Time││           │
│  │  │ Management │ │  Journal   │ │ (Pomodoro) ││           │
│  │  └────────────┘ └────────────┘ └────────────┘│           │
│  └──────────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                              │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐        │
│  │ PostgreSQL   │ │ Drizzle ORM  │ │ In-Memory     │        │
│  │ Core Schema  │ │ Type-Safe DB │ │ Session Store │        │
│  └──────────────┘ └──────────────┘ └───────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

| Feature | Description |
|---------|-------------|
| **AI Risk Simulator** | Random Forest ML model predicting student dropout risks (Low/Medium/High) based on integrated academic metrics |
| **What-If Module** | Interactive simulator showing how changing study habits or grades impacts overall risk scores |
| **Wellness Journal** | Built-in private space for students to reflect on learning and track emotional well-being |
| **Pomodoro Timer** | Integrated time management tool for focused and healthy study sessions |
| **Goal Tracking** | System to establish, track, and manage academic and personal objectives |
| **Teacher Dashboard** | Real-time monitoring of risk levels across student cohorts with detailed profiles |
| **Intervention Management** | Teacher tools to log notes, track intervention methods, and assign support |
| **Direct Messaging** | Secure WebSocket-based real-time communication between students and teachers |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite, React 18, TypeScript 5, Tailwind CSS, shadcn/ui (Radix) |
| Backend | Node.js, Express.js 5 |
| Authentication | Passport.js (Local Strategy) |
| Machine Learning | ml-random-forest (JavaScript implementation) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Protocol / Real-Time | REST + WebSocket (`ws`) |
| Visualization | Recharts, Framer Motion |
| State Management | React Query (`@tanstack/react-query`) |
| Validation | Zod + drizzle-zod |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL server (running locally).

## Demo Flow

1. **Login/Register** → Create an account under a Student or Teacher role.
2. **Student Dashboard** → Access the Pomodoro Timer, verify pending Goals, and log a daily Wellness Journal entry.
3. **What-If Simulator** → Test hypothetical grade improvements to see real-time updates to your dropout risk score (via Random Forest inference).
4. **Teacher Dashboard** → View the class roster mapped out visually and sorted by risk tier (Low/Medium/High).
5. **Issue Intervention** → Click on an at-risk student, analyze their core metrics, and create a targeted intervention note.
6. **Direct Messaging** → Reach out to a student immediately via the integrated real-time chat.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | User registration and role assignment |
| POST | `/api/login` | Session authentication |
| GET | `/api/user` | Fetch current authenticated user profiles |
| GET | `/api/students` | (Teachers) List all students with risk analytics |
| POST | `/api/predict` | Run Random Forest inference for risk scores |
| GET | `/api/journal` | Fetch student wellness journal entries |
| POST | `/api/interventions` | (Teachers) Log a new student intervention |
| GET | `/api/goals` | Fetch and update academic goals |
| WS | `/ws/chat` | Real-time WebSocket messaging feed |

## Risk Prediction Pipeline

```text
Student Activity (Grades, Attendance, App Usage)
    │
    ├─→ Feature Extraction Engine
    │
    ├─→ [Random Forest Model] (ml-random-forest)
    │       │
    │       ▼ (Risk Category Assigned)
    │
    ├─→ Evaluation (Low / Medium / High Risk)
    │
    ├─→ [PARALLEL ROUTING]
    │       ├─→ Update Teacher Dashboard View
    │       ├─→ Trigger Intervention Suggestions
    │       └─→ Adjust Student 'What-If' Baselines
    │
    └─→ Commit Snapshot to Database (Drizzle ORM)
```

## Project Structure

```text
edu-insight/
├── .env                          # Environment variables
├── client/
│   ├── src/
│   │   ├── components/           # Reusable UI (Pomodoro, GoalsPanel, etc.)
│   │   ├── hooks/                # React Query & utility hooks
│   │   ├── pages/                # Specific views (TeacherDashboard, Auth)
│   │   ├── lib/                  # Frontend utilities
│   │   ├── App.tsx               # Wouter Route Manager
│   │   └── index.css             # Tailwind imports
│   └── index.html
├── server/
│   ├── index.ts                  # Express server entry point
│   ├── routes.ts                 # API route handlers & WS setup
│   ├── auth.ts                   # Passport.js strategy logic
│   ├── storage.ts                # Database interface layer
│   └── ml/                       # Machine Learning models
├── shared/
│   └── schema.ts                 # Drizzle schemas + Zod validation
├── package.json
├── drizzle.config.ts
├── tailwind.config.ts
└── README.md
```

## Differentiators

1. **Holistic Approach** — Combines predictive risk analytics with actionable student productivity tools (Pomodoro, Journals).
2. **Local ML Inference** — Uses JavaScript-native `ml-random-forest` for zero-latency, on-server predictions without external API dependencies.
3. **What-If Empowering Simulator** — Doesn't just brand a student "at risk", but lets them simulate how to improve their standing interactively.
4. **WebSocket Real-Time Messaging** — Seamless communication bridges between educators and students when intervention is most needed.
5. **Type-Safe Fullstack Architecture** — End-to-end TypeScript from the React frontend, through the Express layer, into PostgreSQL using Drizzle ORM and Zod.
6. **Secure Auth Integration** — Hardened Express server with Passport.js local sessions and password hashing.
7. **Actionable Teacher Dashboard** — Translates raw analytical risk scores directly into intervention logging workflows.


