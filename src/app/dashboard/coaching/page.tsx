"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { CardSkeleton } from "@/components/loading-skeleton";
import type { CoachingAnalysis } from "@/db/schema";

interface Report {
  id: number;
  analysis: CoachingAnalysis;
  recommendations: string[] | null;
  priorities: string[] | null;
  strategy: string | null;
  insights: string | null;
  motivation: string | null;
  createdAt: string;
}

export default function CoachingPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<Report | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/coaching");
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateReport() {
    setGenerating(true);
    try {
      const res = await fetch("/api/coaching", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Coaching report generated!");
      setActiveReport(data.report);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  const report = activeReport;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🏆 Performance Coach Agent</h1>
          <p className="text-text-secondary mt-1">AI-powered performance analysis and coaching</p>
        </div>
        <button onClick={generateReport} disabled={generating}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          {generating ? "Analyzing..." : "Generate Report"}
        </button>
      </div>

      {report && (
        <div className="space-y-6 mb-8">
          {/* Score + Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle text-center">
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-emerald-500/30 flex items-center justify-center mb-3">
                <span className="text-3xl font-bold text-emerald-400">{report.analysis.overallScore}</span>
              </div>
              <p className="text-sm text-text-secondary">Overall Score</p>
            </div>
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-medium text-text-secondary mb-3">Learning Profile</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Speed</span>
                  <span className="text-emerald-400">{report.analysis.learningSpeed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Consistency</span>
                  <span className="text-emerald-400">{report.analysis.consistency}</span>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-medium text-text-secondary mb-3">Topic Mastery</h4>
              <div className="space-y-2">
                {Object.entries(report.analysis.topicMastery || {}).slice(0, 4).map(([topic, score]) => (
                  <div key={topic}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate">{topic}</span>
                      <span>{score}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-medium text-emerald-400 mb-3">✅ Strengths</h4>
              <ul className="space-y-2">
                {report.analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-medium text-rose-400 mb-3">⚠️ Areas to Improve</h4>
              <ul className="space-y-2">
                {report.analysis.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-rose-400 mt-0.5">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations && (
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-medium text-amber-400 mb-3">📋 Recommendations</h4>
              <ol className="space-y-2">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Strategy & Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.strategy && (
              <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
                <h4 className="text-sm font-medium text-violet-400 mb-3">🎯 Improvement Strategy</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{report.strategy}</p>
              </div>
            )}
            {report.insights && (
              <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
                <h4 className="text-sm font-medium text-cyan-400 mb-3">💡 Learning Insights</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{report.insights}</p>
              </div>
            )}
          </div>

          {/* Motivation */}
          {report.motivation && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <h4 className="text-sm font-medium text-emerald-400 mb-2">🌟 Coach&apos;s Message</h4>
              <p className="text-sm leading-relaxed">{report.motivation}</p>
            </div>
          )}

          <button onClick={() => setActiveReport(null)} className="text-sm text-text-secondary hover:text-text-primary">
            ← Back to all reports
          </button>
        </div>
      )}

      {!report && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="No coaching reports yet"
            description="Upload documents, take quizzes, then generate a coaching report for personalized insights"
            action={{ label: "Generate Report", onClick: generateReport }}
          />
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} onClick={() => setActiveReport(r)}
                className="p-5 rounded-xl bg-surface-card border border-border-subtle hover:border-emerald-500/20 transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-emerald-400">{r.analysis.overallScore}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Performance Report</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-secondary">Speed: {r.analysis.learningSpeed}</span>
                        <span className="text-xs text-text-secondary">·</span>
                        <span className="text-xs text-text-secondary">Consistency: {r.analysis.consistency}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
