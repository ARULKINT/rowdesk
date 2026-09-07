export default function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-[10px] border-2 p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          color: "var(--ink-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-data-stack)",
          fontSize: "1.4rem",
          fontWeight: 600,
          color: accent ? "var(--accent)" : "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
