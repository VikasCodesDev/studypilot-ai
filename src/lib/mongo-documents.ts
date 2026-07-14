import {
  GridFSBucket,
  ObjectId,
  type Document as MongoDocument,
} from "mongodb";
import { callAI, parseAIJson } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";

export interface PdfAnalysis {
  subject: string;
  summary: string;
  chapters: string[];
  topics: string[];
  concepts: string[];
  difficulty: string;
  metadata: Record<string, unknown>;
}

export interface StoredPdfDocument extends MongoDocument {
  _id: ObjectId;
  userId: number;
  filename: string;
  mimeType: string;
  size: number;
  fileId: ObjectId;
  extractedText: string;
  analysis: PdfAnalysis;
  status: "completed" | "failed";
  extractionMethod: string;
  pageCount: number | null;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function mongoId(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid document id");
  }
  return new ObjectId(id);
}

export async function analyzeExtractedText(text: string, filename: string) {
  const result = await callAI({
    systemPrompt:
      "You are an educational PDF Intelligence Agent. Analyze extracted PDF text and return valid JSON only.",
    prompt: `Analyze this educational PDF and return JSON:
{
  "subject": "detected subject or field",
  "summary": "comprehensive 2-3 paragraph summary",
  "chapters": ["chapter or section titles"],
  "topics": ["key topics"],
  "concepts": ["important concepts"],
  "difficulty": "beginner/intermediate/advanced",
  "metadata": {
    "documentType": "notes/textbook/paper/worksheet/other",
    "language": "detected language",
    "estimatedStudyTimeMinutes": 0,
    "keywords": ["searchable keywords"]
  }
}

PDF filename: ${filename}
Extracted text:
${text.substring(0, 10000)}`,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 4096,
  });

  const analysis = parseAIJson<PdfAnalysis>(result.content);
  return { analysis, provider: result.provider, model: result.model };
}

export async function savePdfDocument({
  userId,
  filename,
  mimeType,
  bytes,
  extractedText,
  extractionMethod,
  pageCount,
  analysis,
  aiProvider,
  aiModel,
}: {
  userId: number;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  extractedText: string;
  extractionMethod: string;
  pageCount: number | null;
  analysis: PdfAnalysis;
  aiProvider: string;
  aiModel: string;
}) {
  const mongo = await getMongoDb();
  const bucketName = "pdfs";
  const bucket = new GridFSBucket(mongo, { bucketName });
  const fileId = new ObjectId();
  const now = new Date();

  try {
    await new Promise<void>((resolve, reject) => {
      const upload = bucket.openUploadStreamWithId(fileId, filename, {
        metadata: { userId, uploadedAt: now, contentType: mimeType },
      });
      upload.on("error", reject);
      upload.on("finish", () => resolve());
      upload.end(bytes);
    });
  } catch (err) {
    console.error("[mongo-documents] GridFS upload failed", {
      bucketName,
      userId,
      filename,
      fileId: fileId.toString(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  let insert;
  try {
    insert = await mongo.collection("ai_documents").insertOne({
      userId,
      filename,
      mimeType,
      size: bytes.length,
      fileId,
      extractedText,
      analysis,
      status: "completed",
      extractionMethod,
      pageCount,
      wordCount,
      aiProvider,
      aiModel,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error("[mongo-documents] ai_documents insert failed", {
      userId,
      filename,
      fileId: fileId.toString(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }

  const doc = await mongo
    .collection<StoredPdfDocument>("ai_documents")
    .findOne({
      _id: insert.insertedId,
    });

  if (!doc) {
    console.error("[mongo-documents] Insert succeeded but document not found", {
      userId,
      filename,
      insertedId: insert.insertedId.toString(),
    });
    throw new Error("Saved document not found after insert");
  }

  return doc;
}

export async function listPdfDocuments(userId: number) {
  const mongo = await getMongoDb();
  const docs = await mongo
    .collection<StoredPdfDocument>("ai_documents")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map(toClientDocument);
}

export async function getPdfDocument(userId: number, id: string) {
  const mongo = await getMongoDb();
  return mongo.collection<StoredPdfDocument>("ai_documents").findOne({
    _id: mongoId(id),
    userId,
  });
}

export async function deletePdfDocument(userId: number, id: string) {
  const mongo = await getMongoDb();
  const doc = await getPdfDocument(userId, id);
  if (!doc) return false;

  const bucket = new GridFSBucket(mongo, { bucketName: "pdfs" });
  await bucket.delete(doc.fileId).catch(() => undefined);
  await mongo.collection("ai_documents").deleteOne({ _id: doc._id, userId });
  await mongo.collection("ai_notes").deleteMany({ userId, documentId: id });
  await mongo.collection("ai_quizzes").deleteMany({ userId, documentId: id });
  await mongo
    .collection("ai_study_plans")
    .deleteMany({ userId, documentId: id });
  return true;
}

export async function reanalyzePdfDocument(userId: number, id: string) {
  const mongo = await getMongoDb();
  const doc = await getPdfDocument(userId, id);
  if (!doc) return null;

  const analyzed = await analyzeExtractedText(doc.extractedText, doc.filename);
  await mongo.collection("ai_documents").updateOne(
    { _id: doc._id, userId },
    {
      $set: {
        analysis: analyzed.analysis,
        aiProvider: analyzed.provider,
        aiModel: analyzed.model,
        updatedAt: new Date(),
      },
    },
  );

  return getPdfDocument(userId, id);
}

export async function getPdfFile(userId: number, id: string) {
  const mongo = await getMongoDb();
  const doc = await getPdfDocument(userId, id);
  if (!doc) return null;

  const bucket = new GridFSBucket(mongo, { bucketName: "pdfs" });
  return { doc, stream: bucket.openDownloadStream(doc.fileId) };
}

export function toClientDocument(doc: StoredPdfDocument) {
  return {
    id: doc._id.toString(),
    filename: doc.filename,
    subject: doc.analysis?.subject ?? null,
    summary: doc.analysis?.summary ?? null,
    topics: doc.analysis?.topics ?? [],
    concepts: doc.analysis?.concepts ?? [],
    chapters: doc.analysis?.chapters ?? [],
    difficulty: doc.analysis?.difficulty ?? null,
    metadata: doc.analysis?.metadata ?? {},
    wordCount: doc.wordCount,
    pageCount: doc.pageCount,
    status: doc.status,
    extractionMethod: doc.extractionMethod,
    size: doc.size,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
