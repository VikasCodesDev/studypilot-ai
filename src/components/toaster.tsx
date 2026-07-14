"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#151f32",
          border: "1px solid #1e293b",
          color: "#f1f5f9",
        },
      }}
    />
  );
}
