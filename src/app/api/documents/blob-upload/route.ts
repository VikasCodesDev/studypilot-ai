import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";

// This route never sees the PDF bytes. It only issues a short-lived,
// scoped upload token so the browser can PUT the file straight to
// Vercel Blob storage. That is what lets uploads of 10MB-100MB+ work
// on Vercel without hitting the platform's ~4.5MB request body limit
// for Serverless Functions ("Request Entity Too Large").
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        void clientPayload;
        return {
          allowedContentTypes: ["application/pdf"],
          addRandomSuffix: true,
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB ceiling
          tokenPayload: JSON.stringify({
            userId: user.id,
            pathname,
          }),
        };
      },
      onUploadCompleted: async () => {
        // No server-side action needed here: the client calls
        // POST /api/documents with the resulting blob URL once the
        // upload finishes, which is what triggers extraction/analysis.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[api/documents/blob-upload] token generation failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload authorization failed" },
      { status: 400 },
    );
  }
}
