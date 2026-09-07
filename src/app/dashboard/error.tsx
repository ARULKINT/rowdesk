"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <ErrorState
        title="Couldn't load the queue"
        message="Something went wrong claiming your next record. Your progress on any already-claimed record is safe."
        onRetry={reset}
      />
    </div>
  );
}
