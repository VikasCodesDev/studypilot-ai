"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

interface Analytics {
  stats: {
    documents: number;
    notes: number;
    quizzes: number;
    attempts: number;
    studyPlans: number;
    coachingReports: number;
    avgScore: number;
  };
  weakTopics: { topic: string; count: number }[];
  strongTopics: { topic: string; count: number }[];
  scoreTrend: { attempt: number; score: number; date: string }[];
  recentActivity: { id: number; agentName: string; action: string; status: string; createdAt: string }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-8">📈 Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!data || (data.stats.documents === 0 && data.stats.attempts === 0)) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-8">📈 Analytics</h1>
        <EmptyState
          icon="📈"
          title="No analytics data yet"
          description="Upload documents, generate notes, and take quizzes to see your analytics"
        />
      </div>
    );
  }

  const stats = data.stats;

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">📈 Analytics</h1>
        <p className="text-text-secondary mt-1">Your learning progress and performance data</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Documents", value: stats.documents, icon: "📄" },
          { label: "Notes", value: stats.notes, icon: "📝" },
          { label: "Quiz Attempts", value: stats.attempts, icon: "🧠" },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: "📊" },
          { label: "Quizzes Created", value: stats.quizzes, icon: "✅" },
          { label: "Study Plans", value: stats.studyPlans, icon: "📅" },
          { label: "Coaching Reports", value: stats.coachingReports, icon: "🏆" },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-xl bg-surface-card border border-border-subtle">
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-xs text-text-secondary">{s.label}</span>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Score Trend Chart */}
      {data.scoreTrend.length > 0 && (
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle mb-8">
          <h3 className="font-semibold mb-6">Quiz Score Trend</h3>
          <div className="flex items-end gap-3 h-48">
            {data.scoreTrend.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-emerald-400">{s.score}%</span>
                <div className="w-full relative" style={{ height: "160px" }}>
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 to-teal-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(s.score * 1.6, 8)}px` }}
                  />
                </div>
                <span className="text-[10px] text-text-secondary">{s.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Topic Mastery - Strong */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4 text-emerald-400">Strong Topics</h3>
          {data.strongTopics.length > 0 ? (
            <div className="space-y-3">
              {data.strongTopics.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t.topic}</span>
                    <span className="text-emerald-400">{t.count} correct</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${Math.min(t.count * 20, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Take quizzes to identify strong topics</p>
          )}
        </div>

        {/* Topic Mastery - Weak */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4 text-rose-400">Topics to Improve</h3>
          {data.weakTopics.length > 0 ? (
            <div className="space-y-3">
              {data.weakTopics.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t.topic}</span>
                    <span className="text-rose-400">{t.count} mistakes</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                      style={{ width: `${Math.min(t.count * 20, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No weak topics identified yet</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Recent AI Activity</h3>
          <div className="space-y-3">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2">
                <div className={`w-2 h-2 mt-2 rounded-full ${a.status === "success" ? "bg-emerald-400" : "bg-amber-400"}`} />
                <div className="flex-1">
                  <p className="text-sm">{a.action}</p>
                  <p className="text-xs text-text-secondary">{a.agentName} · {new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
