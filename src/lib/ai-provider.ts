// Centralized AI Provider Service with Groq + Gemini.
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

interface AIRequestOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

interface AIResponse {
  content: string;
  provider: string;
  model: string;
}

const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const GEMINI_MODELS = ["gemini-2.0-flash"];

const MAX_RETRIES = 2;
const TIMEOUT_MS = 60000;

async function callGroq(options: AIRequestOptions): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const model = GROQ_MODELS[0];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        ...(options.systemPrompt
          ? [{ role: "system" as const, content: options.systemPrompt }]
          : []),
        { role: "user" as const, content: options.prompt },
      ],
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    };

    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) throw new Error(`RATE_LIMIT: ${errText}`);
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");

    return { content, provider: "groq", model };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(options: AIRequestOptions): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

  const model = GEMINI_MODELS[0];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts: Array<{ text: string }> = [];
    if (options.systemPrompt) {
      parts.push({ text: `System: ${options.systemPrompt}\n\n` });
    }
    parts.push({ text: options.prompt });

    const body: Record<string, unknown> = {
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      },
    };

    if (options.jsonMode) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) throw new Error(`RATE_LIMIT: ${errText}`);
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Empty response from Gemini");

    return { content, provider: "gemini", model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractPdfTextWithGemini(
  pdfBuffer: Buffer,
  filename: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

  const model = GEMINI_MODELS[0];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract all readable educational text from this PDF named "${filename}". If pages are scanned images, perform OCR. Return only the extracted text, preserving headings and paragraph order where possible.`,
              },
              {
                inline_data: {
                  mimeType: "application/pdf",
                  data: pdfBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini PDF extraction error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Empty PDF extraction response from Gemini");

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const errors: string[] = [];

  // Try Groq first
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await callGroq(options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Groq attempt ${i + 1}: ${msg}`);
      if (msg.includes("not configured")) break;
      if (!msg.includes("RATE_LIMIT") && i < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  // Fallback to Gemini
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await callGemini(options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Gemini attempt ${i + 1}: ${msg}`);
      if (msg.includes("not configured")) break;
      if (!msg.includes("RATE_LIMIT") && i < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  console.error("[AI Provider] All providers failed:", errors);
  throw new Error(
    `AI service unavailable. Configure GROQ_API_KEY or GOOGLE_GEMINI_API_KEY. Errors: ${errors.join("; ")}`
  );
}

export function parseAIJson<T>(content: string): T {
  // Try direct parse
  try {
    return JSON.parse(content) as T;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        // fall through
      }
    }
    // Try finding JSON object/array
    const objectMatch = content.match(/(\{[\s\S]*\})/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[1]) as T;
      } catch {
        // fall through
      }
    }
    const arrayMatch = content.match(/(\[[\s\S]*\])/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[1]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

export function getAIStatus(): { groq: boolean; gemini: boolean } {
  return {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
  };
}
