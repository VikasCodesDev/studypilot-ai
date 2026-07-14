import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  serial,
  varchar,
  real,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash"),
  // avatarUrl is optional; keep it nullable if your DB doesn't have it yet.
  avatarUrl: text("avatar_url"),

  provider: varchar("provider", { length: 50 }).default("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sessions table
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PDFs / Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 500 }).notNull(),
  originalText: text("original_text"),
  subject: varchar("subject", { length: 255 }),
  summary: text("summary"),
  chapters: jsonb("chapters").$type<string[]>(),
  topics: jsonb("topics").$type<string[]>(),
  concepts: jsonb("concepts").$type<string[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  pageCount: integer("page_count"),
  wordCount: integer("word_count"),
  status: varchar("status", { length: 50 }).default("processing").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Smart Notes
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // detailed, revision, summary, cheatsheet, flashcards, keypoints, formulas
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  topic: varchar("topic", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quizzes
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  difficulty: varchar("difficulty", { length: 50 }).notNull(),
  questionType: varchar("question_type", { length: 50 }).notNull(),
  questions: jsonb("questions").notNull().$type<QuizQuestion[]>(),
  totalQuestions: integer("total_questions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz Attempts
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull().$type<UserAnswer[]>(),
  score: real("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  feedback: text("feedback"),
  weakTopics: jsonb("weak_topics").$type<string[]>(),
  strongTopics: jsonb("strong_topics").$type<string[]>(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// Study Plans
export const studyPlans = pgTable("study_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentId: integer("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  type: varchar("type", { length: 50 }).notNull(), // daily, weekly, monthly, exam, revision
  title: varchar("title", { length: 500 }).notNull(),
  plan: jsonb("plan").notNull().$type<StudyPlanItem[]>(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Performance Coaching
export const coachingReports = pgTable("coaching_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  analysis: jsonb("analysis").notNull().$type<CoachingAnalysis>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  priorities: jsonb("priorities").$type<string[]>(),
  strategy: text("strategy"),
  insights: text("insights"),
  motivation: text("motivation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Activity Log
export const aiActivityLog = pgTable("ai_activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  details: text("details"),
  provider: varchar("provider", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Settings
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  theme: varchar("theme", { length: 20 }).default("dark"),
  language: varchar("language", { length: 10 }).default("en"),
  notifications: boolean("notifications").default(true),
  emailNotifications: boolean("email_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type definitions for JSONB columns
export interface QuizQuestion {
  id: number;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  topic?: string;
}

export interface UserAnswer {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
}

export interface StudyPlanItem {
  day?: string;
  date?: string;
  time?: string;
  topic: string;
  duration: string;
  priority: string;
  completed?: boolean;
  notes?: string;
}

export interface CoachingAnalysis {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  learningSpeed: string;
  consistency: string;
  topicMastery: Record<string, number>;
}
