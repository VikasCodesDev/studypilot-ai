"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import type { QuizQuestion, UserAnswer } from "@/db/schema";

interface Document { id: string; filename: string; }
interface Quiz { id: string; title: string; difficulty: string; questionType: string; questions: QuizQuestion[]; totalQuestions: number; createdAt: string; }
interface Attempt { id: string; quizId: string; score: number; totalQuestions: number; correctAnswers: number; feedback: string | null; weakTopics: string[] | null; strongTopics: string[] | null; completedAt: string; answers: UserAnswer[]; }

export default function QuizzesPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [quizzesList, setQuizzesList] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState("mcq");
  const [count, setCount] = useState(5);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ attempt: Attempt; questions: QuizQuestion[] } | null>(null);
  const [tab, setTab] = useState<"generate" | "history">("generate");

  const fetchData = useCallback(async () => {
    try {
      const [docRes, quizRes, attRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/quizzes"),
        fetch("/api/quizzes/attempts"),
      ]);
      setDocs((await docRes.json()).documents || []);
      setQuizzesList((await quizRes.json()).quizzes || []);
      setAttempts((await attRes.json()).attempts || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateQuiz() {
    if (!selectedDoc) { toast.error("Select a document first"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selectedDoc, difficulty, questionType, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Quiz generated!");
      setActiveQuiz(data.quiz);
      setUserAnswers({});
      setResult(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  }

  async function submitQuiz() {
    if (!activeQuiz) return;
    const answered = Object.keys(userAnswers).length;
    if (answered < activeQuiz.questions.length) {
      if (!confirm(`You've answered ${answered}/${activeQuiz.questions.length} questions. Submit anyway?`)) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quizzes/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: userAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Quiz submitted! Score: ${data.attempt.score.toFixed(0)}%`);
      setResult(data);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  // Result view
  if (result) {
    const { attempt, questions } = result;
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">🧠 Quiz Results</h1>
          <button onClick={() => { setResult(null); setActiveQuiz(null); }} className="text-sm text-emerald-400 hover:text-emerald-300 mt-1">
            ← Back to quizzes
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle text-center">
            <p className="text-4xl font-bold text-emerald-400">{attempt.score.toFixed(0)}%</p>
            <p className="text-sm text-text-secondary mt-1">Score</p>
          </div>
          <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle text-center">
            <p className="text-4xl font-bold">{attempt.correctAnswers}/{attempt.totalQuestions}</p>
            <p className="text-sm text-text-secondary mt-1">Correct Answers</p>
          </div>
          <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle">
            <p className="text-sm font-medium mb-2">AI Feedback</p>
            <p className="text-sm text-text-secondary">{attempt.feedback}</p>
          </div>
        </div>
        {attempt.weakTopics && attempt.weakTopics.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-sm font-medium text-rose-400 mb-1">Weak Topics</p>
            <p className="text-sm text-text-secondary">{attempt.weakTopics.join(", ")}</p>
          </div>
        )}
        <div className="space-y-4">
          {questions.map((q, i) => {
            const ua = attempt.answers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} className={`p-5 rounded-2xl border ${ua?.isCorrect ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                <p className="font-medium text-sm mb-3">Q{i + 1}. {q.question}</p>
                {q.options && (
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`text-sm px-3 py-2 rounded-lg ${
                        q.correctAnswer.toLowerCase().includes(opt.toLowerCase().substring(3)) ? "bg-emerald-500/10 text-emerald-400" :
                        ua?.userAnswer === opt ? "bg-rose-500/10 text-rose-400" : "text-text-secondary"
                      }`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-text-secondary">Your answer: </span>
                  <span className={ua?.isCorrect ? "text-emerald-400" : "text-rose-400"}>{ua?.userAnswer || "(no answer)"}</span>
                </div>
                {!ua?.isCorrect && (
                  <div className="text-sm mt-1">
                    <span className="text-text-secondary">Correct: </span>
                    <span className="text-emerald-400">{q.correctAnswer}</span>
                  </div>
                )}
                {q.explanation && (
                  <p className="text-xs text-text-secondary mt-2 italic">{q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active quiz view
  if (activeQuiz) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">🧠 {activeQuiz.title}</h1>
          <p className="text-text-secondary mt-1">{activeQuiz.totalQuestions} questions · {activeQuiz.difficulty} difficulty</p>
        </div>
        <div className="space-y-6">
          {activeQuiz.questions.map((q, i) => (
            <div key={q.id} className="p-5 rounded-2xl bg-surface-card border border-border-subtle">
              <p className="font-medium text-sm mb-4">Q{i + 1}. {q.question}</p>
              {q.options ? (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setUserAnswers((p) => ({ ...p, [q.id]: opt }))}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                        userAnswers[q.id] === opt
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                          : "bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={userAnswers[q.id] || ""}
                  onChange={(e) => setUserAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary resize-none focus:outline-none focus:border-emerald-500/50"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={() => setActiveQuiz(null)} className="text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">
              {Object.keys(userAnswers).length}/{activeQuiz.questions.length} answered
            </span>
            <button
              onClick={submitQuiz}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🧠 Quiz & Evaluation Agent</h1>
          <p className="text-text-secondary mt-1">AI-generated quizzes with evaluation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("generate")} className={`px-4 py-2 rounded-lg text-sm ${tab === "generate" ? "bg-emerald-500/10 text-emerald-400" : "text-text-secondary"}`}>Generate</button>
          <button onClick={() => setTab("history")} className={`px-4 py-2 rounded-lg text-sm ${tab === "history" ? "bg-emerald-500/10 text-emerald-400" : "text-text-secondary"}`}>History</button>
        </div>
      </div>

      {tab === "generate" && (
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle mb-8">
          <h3 className="font-semibold mb-4">Generate New Quiz</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Document</label>
              <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
                <option value="">Select document</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Type</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
                <option value="mcq">Multiple Choice</option>
                <option value="subjective">Subjective</option>
                <option value="coding">Coding/Problem</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Questions</label>
              <select value={count} onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50">
                {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
          </div>
          <button onClick={generateQuiz} disabled={generating || !selectedDoc}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/20">
            {generating ? "Generating..." : "Generate Quiz"}
          </button>
        </div>
      )}

      {/* Previous Quizzes */}
      {loading ? <TableSkeleton /> : (
        tab === "generate" ? (
          quizzesList.length === 0 ? (
            <EmptyState icon="🧠" title="No quizzes yet" description="Generate your first quiz from a document above" />
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold mb-3">Previous Quizzes</h3>
              {quizzesList.map((q) => (
                <div key={q.id} className="p-4 rounded-xl bg-surface-card border border-border-subtle hover:border-amber-500/20 transition-all cursor-pointer"
                  onClick={() => { setActiveQuiz(q); setUserAnswers({}); setResult(null); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{q.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{q.difficulty}</span>
                        <span className="text-xs text-text-secondary">{q.totalQuestions} questions</span>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 hover:underline">Take Quiz →</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          attempts.length === 0 ? (
            <EmptyState icon="📊" title="No attempts yet" description="Take a quiz to see your history" />
          ) : (
            <div className="space-y-3">
              {attempts.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-surface-card border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Score: {a.score.toFixed(0)}% ({a.correctAnswers}/{a.totalQuestions})</p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.weakTopics && a.weakTopics.length > 0 && (
                          <span className="text-xs text-rose-400">Weak: {a.weakTopics.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-text-secondary">{new Date(a.completedAt).toLocaleDateString()}</span>
                  </div>
                  {a.feedback && <p className="text-xs text-text-secondary mt-2">{a.feedback}</p>}
                </div>
              ))}
            </div>
          )
        )
      )}
    </div>
  );
}
