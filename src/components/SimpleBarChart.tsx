export interface BarDatum {
  label: string;
  value: number;
}

export default function SimpleBarChart({
  data,
  height = 140,
}: {
  data: BarDatum[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barAreaHeight = height - 34;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: "0.62rem",
              fontFamily: "var(--font-data-stack)",
              color: "var(--ink-muted)",
            }}
          >
            {d.value > 0 ? d.value : ""}
          </div>
          <div
            style={{
              width: "100%",
              height: Math.max(d.value > 0 ? 3 : 0, (d.value / max) * barAreaHeight),
              background: "var(--accent)",
              borderRadius: "3px 3px 0 0",
            }}
          />
          <div
            style={{
              fontSize: "0.6rem",
              fontFamily: "var(--font-data-stack)",
              color: "var(--ink-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}
