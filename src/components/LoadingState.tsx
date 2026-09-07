export default function LoadingState() {
  return (
    <div
      className="mx-auto my-12 flex w-full max-w-[480px] items-center justify-center gap-2.5 rounded-[12px] border-2 p-6"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
    >
      <span
        className="inline-block h-2 w-2 animate-pulse rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <span
        className="text-[0.85rem]"
        style={{ color: "var(--ink-muted)", fontFamily: "var(--font-data-stack)" }}
      >
        Loading…
      </span>
    </div>
  );
}
