"use client";

export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="mx-auto my-12 w-full max-w-[480px] rounded-[12px] border-2 p-6 text-center"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p
        className="mb-2 text-[1.05rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        {title}
      </p>
      <p className="mb-5 text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
        {message ?? "Try again, or come back in a moment."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold"
          style={{
            borderColor: "var(--border)",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
