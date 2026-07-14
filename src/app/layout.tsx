import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/toaster";

export const metadata: Metadata = {
  title: "StudyPilot AI - Intelligent Learning Platform",
  description: "AI-powered study platform for quality education - UN SDG 4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
