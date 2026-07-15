"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";

interface Document { id: string; filename: string; }
interface PlanItem { day?: string; time?: string; topic: string; duration: string; priority: string; notes?: string; completed?: boolean; }
interface StudyPlan { id: string; type: string; title: string; plan: PlanItem[]; status: string; createdAt: string; }

const PLAN_TYPES = [
  { value: "daily", label: "📆 Daily Plan", desc: "Today's schedule" },
  { value: "weekly", label: "📅 Weekly Plan", desc: "7-day overview" },
  { value: "monthly", label: "🗓️ Monthly Plan", desc: "Month milestones" },
  { value: "exam", label: "🎯 Exam Prep", desc: "Exam countdown" },
  { value: "revision", label: "🔄 Revision", desc: "Review weak areas" },
];

export default function PlannerPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [planType, setPlanType] = useState("daily");
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("4");
  const [viewPlan, setViewPlan] = useState<StudyPlan | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [docRes, planRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/study-plans"),
      ]);
      setDocs((await docRes.json()).documents || []);
      setPlans((await planRes.json()).plans || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generatePlan() {
    setGenerating(true);
    try {
      const res = await fetch("/api/study-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: planType,
          documentId: selectedDoc || undefined,
          examDate: examDate || undefined,
          hoursPerDay: hoursPerDay || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Study plan generated!");
      setViewPlan(data.plan);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  const priorityColor: Record<string, string> = {
    high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">📅 Study Planner Agent</h1>
        <p className="text-text-secondary mt-1">AI-generated adaptive study plans</p>
      </div>

      {/* Generator */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle mb-8">
        <h3 className="font-semibold mb-4">Create Study Plan</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {PLAN_TYPES.map((t) => (
            <button key={t.value} onClick={() => setPlanType(t.value)}
              className={`p-3 rounded-xl text-xs text-center transition-all ${
                planType === t.value ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover"
              }`}>
              <div className="text-lg mb-1">{t.label.split(" ")[0]}</div>
              {t.desc}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Document (optional)</label>
            <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
              <option value="">General plan</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
            </select>
          </div>
          {planType === "exam" && (
            <div>
              <label className="block text-sm text-text-secondary mb-2">Exam Date</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50" />
            </div>
          )}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Hours/Day</label>
            <select value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </div>
        </div>
        <button onClick={generatePlan} disabled={generating}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          {generating ? "Generating Plan..." : "Generate Study Plan"}
        </button>
      </div>

      {/* View Plan */}
      {viewPlan && (
        <div className="mb-8 p-6 rounded-2xl bg-surface-card border border-emerald-500/20 glow-emerald">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">{viewPlan.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{viewPlan.type}</span>
            </div>
            <button onClick={() => setViewPlan(null)} className="text-text-secondary hover:text-text-primary">✕</button>
          </div>
          <div className="space-y-3">
            {viewPlan.plan.map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border-subtle">
                <div className="text-center min-w-[60px]">
                  {item.day && <p className="text-sm font-medium">{item.day}</p>}
                  {item.time && <p className="text-xs text-text-secondary">{item.time}</p>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.topic}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-text-secondary">⏱ {item.duration}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColor[item.priority] || priorityColor.medium}`}>
                      {item.priority}
                    </span>
                  </div>
                  {item.notes && <p className="text-xs text-text-secondary mt-1">{item.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? <TableSkeleton /> : plans.length === 0 && !viewPlan ? (
        <EmptyState icon="📅" title="No study plans yet" description="Generate your first AI study plan above" />
      ) : (
        <div className="space-y-3">
          {plans.filter(p => p.id !== viewPlan?.id).map((plan) => (
            <div key={plan.id} onClick={() => setViewPlan(plan)}
              className="p-4 rounded-xl bg-surface-card border border-border-subtle hover:border-emerald-500/20 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">{plan.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{plan.type}</span>
                    <span className="text-xs text-text-secondary">{plan.plan.length} items</span>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">{new Date(plan.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
