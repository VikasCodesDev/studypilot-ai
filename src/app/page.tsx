"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: "📄",
      title: "PDF Intelligence",
      desc: "Upload documents and let AI extract subjects, topics, concepts, and summaries automatically.",
      gradient: "from-emerald-500/20 to-teal-500/20",
    },
    {
      icon: "📝",
      title: "Smart Notes",
      desc: "Generate detailed notes, revision sheets, flashcards, cheat sheets, and more from your PDFs.",
      gradient: "from-violet-500/20 to-purple-500/20",
    },
    {
      icon: "🧠",
      title: "Quiz & Evaluation",
      desc: "AI-generated quizzes with MCQs, subjective questions, instant evaluation, and feedback.",
      gradient: "from-amber-500/20 to-orange-500/20",
    },
    {
      icon: "📅",
      title: "Study Planner",
      desc: "Adaptive daily, weekly, and monthly plans that evolve based on your quiz performance.",
      gradient: "from-rose-500/20 to-pink-500/20",
    },
    {
      icon: "🏆",
      title: "Performance Coach",
      desc: "AI coaching with insights, recommendations, and strategies based on your learning data.",
      gradient: "from-cyan-500/20 to-blue-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              StudyPilot AI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Powered by AI — UN SDG 4: Quality Education
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Your AI-Powered
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Study Companion
            </span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10">
            Upload your study materials and let 5 autonomous AI agents transform your learning.
            Smart notes, quizzes, study plans, and coaching — all personalized for you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/register")}
              className="px-8 py-3.5 text-base font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              Start Learning Free →
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-8 py-3.5 text-base font-medium glass text-text-secondary rounded-xl hover:text-text-primary transition-all hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            5 Autonomous AI Agents
          </h2>
          <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto">
            Each agent works independently, analyzing your documents and learning patterns to deliver personalized education.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-2xl bg-surface-card border border-border-subtle transition-all duration-300 cursor-default ${
                  hoveredFeature === i ? "border-emerald-500/30 -translate-y-1 shadow-xl shadow-emerald-500/5" : "hover:border-border-subtle/80"
                }`}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-2xl mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDG 4 Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-6">
            🎯 IBM SkillsBuild AI Internship
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Advancing UN SDG 4: Quality Education
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            StudyPilot AI democratizes access to intelligent tutoring, providing every learner with
            AI-powered study tools regardless of their background or resources.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="text-sm text-text-secondary">StudyPilot AI © 2025</span>
          </div>
          <p className="text-xs text-text-secondary">
            Built for IBM SkillsBuild AI Internship — UN SDG 4: Quality Education
          </p>
        </div>
      </footer>
    </div>
  );
}
