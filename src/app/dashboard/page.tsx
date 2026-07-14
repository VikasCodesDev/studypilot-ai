"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CardSkeleton } from "@/components/loading-skeleton";

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
  recentDocuments: { id: number; filename: string; subject: string | null; status: string; createdAt: string }[];
}

export default function DashboardOverview() {
  const { user } = useAuth();
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
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const stats = data?.stats || { documents: 0, notes: 0, quizzes: 0, attempts: 0, studyPlans: 0, coachingReports: 0, avgScore: 0 };

  const statCards = [
    { label: "Uploaded PDFs", value: stats.documents, icon: "📄", color: "emerald" },
    { label: "Generated Notes", value: stats.notes, icon: "📝", color: "violet" },
    { label: "Quiz Attempts", value: stats.attempts, icon: "🧠", color: "amber" },
    { label: "Avg. Score", value: `${stats.avgScore}%`, icon: "📊", color: "cyan" },
    { label: "Study Plans", value: stats.studyPlans, icon: "📅", color: "rose" },
    { label: "Coaching Reports", value: stats.coachingReports, icon: "🏆", color: "teal" },
    { label: "Quizzes Created", value: stats.quizzes, icon: "✅", color: "emerald" },
  ];

  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/20",
    teal: "from-teal-500/20 to-teal-500/5 border-teal-500/20",
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-text-secondary">Here&apos;s your learning progress overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((s, i) => (
          <div
            key={i}
            className={`p-5 rounded-2xl bg-gradient-to-br ${colorMap[s.color] || colorMap.emerald} border transition-all hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{s.icon}</span>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-text-secondary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Trend */}
        {(data?.scoreTrend?.length ?? 0) > 0 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
            <h3 className="font-semibold mb-4">Quiz Score Trend</h3>
            <div className="flex items-end gap-2 h-40">
              {data!.scoreTrend.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-text-secondary">{s.score}%</span>
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-teal-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(s.score, 5)}%` }}
                  />
                  <span className="text-[10px] text-text-secondary">{s.attempt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Topics */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Topics to Improve</h3>
          {(data?.weakTopics?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data!.weakTopics.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{t.topic}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {t.count} mistakes
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Take quizzes to identify weak topics</p>
          )}
        </div>

        {/* Strong Topics */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Strong Topics</h3>
          {(data?.strongTopics?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data!.strongTopics.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{t.topic}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {t.count} correct
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Take quizzes to identify strong topics</p>
          )}
        </div>

        {/* Recent AI Activity */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Recent AI Activity</h3>
          {(data?.recentActivity?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data!.recentActivity.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className={`w-2 h-2 mt-1.5 rounded-full ${a.status === "success" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{a.action}</p>
                    <p className="text-xs text-text-secondary">{a.agentName} · {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No AI activity yet. Start by uploading a document.</p>
          )}
        </div>
      </div>

      {/* Recent Documents */}
      {(data?.recentDocuments?.length ?? 0) > 0 && (
        <div className="mt-6 p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Recent Documents</h3>
          <div className="space-y-2">
            {data!.recentDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-sm font-medium">{doc.filename}</p>
                    <p className="text-xs text-text-secondary">{doc.subject || "Processing..."}</p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">{new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
