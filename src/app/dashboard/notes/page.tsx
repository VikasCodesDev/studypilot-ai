"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";

interface Document { id: number; filename: string; subject: string | null; }
interface Note { id: number; documentId: number; type: string; title: string; content: string; topic: string | null; createdAt: string; }

const NOTE_TYPES = [
  { value: "detailed", label: "📚 Detailed Notes", desc: "Comprehensive study notes" },
  { value: "revision", label: "🔄 Revision Notes", desc: "Quick review material" },
  { value: "summary", label: "📋 Summary", desc: "Chapter/topic summary" },
  { value: "cheatsheet", label: "⚡ Cheat Sheet", desc: "Quick reference" },
  { value: "flashcards", label: "🎴 Flashcards", desc: "Q&A flashcards" },
  { value: "keypoints", label: "🎯 Key Points", desc: "Essential takeaways" },
  { value: "formulas", label: "🔢 Formula Sheet", desc: "Formulas & equations" },
];

export default function NotesPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<number | "">("");
  const [noteType, setNoteType] = useState("detailed");
  const [topicInput, setTopicInput] = useState("");
  const [viewNote, setViewNote] = useState<Note | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [docRes, noteRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/notes"),
      ]);
      const docData = await docRes.json();
      const noteData = await noteRes.json();
      setDocs(docData.documents || []);
      setNotesList(noteData.notes || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateNotes() {
    if (!selectedDoc) { toast.error("Select a document first"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selectedDoc, type: noteType, topic: topicInput || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Notes generated!");
      setViewNote(data.note);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate notes");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">📝 Smart Notes Agent</h1>
        <p className="text-text-secondary mt-1">AI-generated study notes from your documents</p>
      </div>

      {/* Generator */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle mb-8">
        <h3 className="font-semibold mb-4">Generate Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Document</label>
            <select
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Select a document</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Topic (optional)</label>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Focus on specific topic"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setNoteType(t.value)}
              className={`p-3 rounded-xl text-xs text-center transition-all ${
                noteType === t.value
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <div className="text-lg mb-1">{t.label.split(" ")[0]}</div>
              {t.label.split(" ").slice(1).join(" ")}
            </button>
          ))}
        </div>
        <button
          onClick={generateNotes}
          disabled={generating || !selectedDoc}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
        >
          {generating ? "Generating with AI..." : "Generate Notes"}
        </button>
      </div>

      {/* View Note */}
      {viewNote && (
        <div className="mb-8 p-6 rounded-2xl bg-surface-card border border-emerald-500/20 glow-emerald">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{viewNote.title}</h3>
            <button onClick={() => setViewNote(null)} className="text-text-secondary hover:text-text-primary">✕</button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {viewNote.content}
          </div>
        </div>
      )}

      {/* Notes List */}
      {loading ? (
        <TableSkeleton />
      ) : notesList.length === 0 && !viewNote ? (
        <EmptyState
          icon="📝"
          title="No notes generated yet"
          description="Select a document above and generate your first set of notes"
        />
      ) : (
        <div className="grid gap-3">
          {notesList.map((note) => (
            <div
              key={note.id}
              onClick={() => setViewNote(note)}
              className="p-4 rounded-xl bg-surface-card border border-border-subtle hover:border-violet-500/20 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">{note.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">{note.type}</span>
                    {note.topic && <span className="text-xs text-text-secondary">{note.topic}</span>}
                  </div>
                </div>
                <span className="text-xs text-text-secondary">{new Date(note.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
