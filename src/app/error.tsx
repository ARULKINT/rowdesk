"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <ErrorState onRetry={reset} />
    </div>
  );
}
