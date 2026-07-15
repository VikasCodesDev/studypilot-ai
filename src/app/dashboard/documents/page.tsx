"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";

const MAX_PDF_MB = 5;

interface Document {
  id: string;
  filename: string;
  subject: string | null;
  summary: string | null;
  topics: string[];
  concepts: string[];
  chapters: string[];
  difficulty: string | null;
  extractionMethod: string;
  wordCount: number | null;
  pageCount: number | null;
  size: number;
  status: string;
  createdAt: string;
}

type Stage = "idle" | "uploading" | "extracting" | "analyzing" | "saving" | "complete" | "error";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const busy = stage === "uploading" || stage === "extracting" || stage === "analyzing" || stage === "saving";

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocs(data.documents || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch PDFs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const statusText = useMemo(() => {
    if (stage === "uploading") return "Uploading PDF";
    if (stage === "extracting") return "Extracting text and running OCR if needed";
    if (stage === "analyzing") return "Detecting subject, chapters, concepts, difficulty and metadata";
    if (stage === "saving") return "Saving PDF and AI data to MongoDB";
    if (stage === "complete") return "PDF Intelligence analysis complete";
    if (stage === "error") return "PDF processing failed";
    return "Ready for PDF upload";
  }, [stage]);

  function chooseFile(file: File) {
    setError("");
    setStage("idle");
    setProgress(0);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      setStage("error");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`PDF is too large. Maximum supported size is ${MAX_PDF_MB}MB.`);
      setStage("error");
      return;
    }
    setSelectedFile(file);
  }

  async function uploadPdf(file = selectedFile) {
    if (!file) {
      setError("Choose a PDF first.");
      setStage("error");
      return;
    }

    setError("");
    setStage("uploading");
    setProgress(20);

    const timers = [
      window.setTimeout(() => {
        setStage("extracting");
        setProgress(45);
      }, 700),
      window.setTimeout(() => {
        setStage("analyzing");
        setProgress(70);
      }, 1800),
      window.setTimeout(() => {
        setStage("saving");
        setProgress(88);
      }, 3200),
    ];

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProgress(100);
      setStage("complete");
      setSelectedFile(null);
      setSelectedDoc(data.document);
      await fetchDocs();
      toast.success("PDF analyzed and saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    } finally {
      timers.forEach(window.clearTimeout);
    }
  }

  async function deletePdf(id: string) {
    if (!confirm("Delete this PDF and its generated AI data?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedDoc?.id === id) setSelectedDoc(null);
      await fetchDocs();
      toast.success("PDF deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete PDF");
    }
  }

  async function reanalyzePdf(id: string) {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedDoc(data.document);
      await fetchDocs();
      toast.success("PDF re-analyzed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to re-analyze PDF");
    } finally {
      setReanalyzingId(null);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) chooseFile(file);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">PDF Intelligence Agent</h1>
          <p className="text-text-secondary mt-1">Upload PDFs for extraction, OCR, and AI document analysis</p>
        </div>
        <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium cursor-pointer disabled:opacity-50">
          Select PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) chooseFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`min-h-72 rounded-2xl border border-dashed p-6 transition-colors ${
              dragActive ? "border-emerald-400 bg-emerald-500/10" : "border-border-subtle bg-surface-card"
            }`}
          >
            {previewUrl ? (
              <iframe src={previewUrl} className="h-[520px] w-full rounded-xl border border-border-subtle bg-white" title="PDF preview" />
            ) : selectedDoc ? (
              <iframe
                src={`/api/documents/${selectedDoc.id}/file`}
                className="h-[520px] w-full rounded-xl border border-border-subtle bg-white"
                title="Stored PDF preview"
              />
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center text-center">
                <div className="text-4xl font-bold text-emerald-400">PDF</div>
                <h2 className="mt-4 text-lg font-semibold">Drag and drop a PDF here</h2>
                <p className="mt-3 text-xs text-amber-400">
                  Maximum upload size: 5 MB
                    </p>
                <p className="mt-2 max-w-md text-sm text-text-secondary">
                  The agent extracts text, uses Gemini OCR for scanned PDFs, analyzes the content, and stores the result in MongoDB.
                </p>
                 <p className="text-xs text-amber-400">
                  Supported format: PDF • Maximum file size: 5 MB
                    </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">Processing Status</h3>
                <p className="mt-1 text-sm text-text-secondary">{statusText}</p>
              </div>
              <button
                onClick={() => uploadPdf()}
                disabled={!selectedFile || busy}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Upload and Analyze
              </button>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            {selectedFile && (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Info label="File" value={selectedFile.name} />
                <Info label="Size" value={formatBytes(selectedFile.size)} />
                <Info label="Type" value={selectedFile.type || "application/pdf"} />
              </div>
            )}
          </div>

          {selectedDoc && (
            <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{selectedDoc.filename}</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selectedDoc.subject || "Unknown subject"} · {selectedDoc.difficulty || "unknown difficulty"} · {selectedDoc.extractionMethod}
                  </p>
                </div>
                <button
                  onClick={() => reanalyzePdf(selectedDoc.id)}
                  disabled={reanalyzingId === selectedDoc.id}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  {reanalyzingId === selectedDoc.id ? "Re-analyzing..." : "Re-analyze"}
                </button>
              </div>
              {selectedDoc.summary && <p className="mt-4 text-sm leading-relaxed">{selectedDoc.summary}</p>}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TagBlock title="Chapters" values={selectedDoc.chapters} />
                <TagBlock title="Concepts" values={selectedDoc.concepts} />
                <TagBlock title="Topics" values={selectedDoc.topics} />
                <div className="rounded-xl bg-surface p-4 text-sm">
                  <p className="text-text-secondary">Extracted text</p>
                  <p className="mt-1">{selectedDoc.wordCount?.toLocaleString() || 0} words across {selectedDoc.pageCount || "unknown"} pages</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h3 className="font-semibold">Recent Uploaded PDFs</h3>
          {loading ? (
            <div className="mt-4"><TableSkeleton /></div>
          ) : docs.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon="PDF" title="No PDFs yet" description="Upload a PDF to start analysis" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    selectedDoc?.id === doc.id ? "border-emerald-500/40 bg-emerald-500/10" : "border-border-subtle bg-surface"
                  }`}
                >
                  <button className="w-full text-left" onClick={() => setSelectedDoc(doc)}>
                    <p className="truncate text-sm font-medium">{doc.filename}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {doc.subject || "Analyzed PDF"} · {formatBytes(doc.size)}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">{new Date(doc.createdAt).toLocaleString()}</p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => reanalyzePdf(doc.id)}
                      disabled={reanalyzingId === doc.id}
                      className="flex-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                    >
                      Re-analyze
                    </button>
                    <button
                      onClick={() => deletePdf(doc.id)}
                      className="rounded-lg border border-rose-500/20 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 truncate text-sm">{value}</p>
    </div>
  );
}

function TagBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value) => (
          <span key={value} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            {value}
          </span>
        )) : <span className="text-xs text-text-secondary">None detected</span>}
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
