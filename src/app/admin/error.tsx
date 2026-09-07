"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Couldn't load this admin page"
      message="Something went wrong loading this page's data."
      onRetry={reset}
    />
  );
}
