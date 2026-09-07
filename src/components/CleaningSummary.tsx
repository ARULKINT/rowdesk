export interface CleaningSummaryData {
  totalRows: number;
  removedMissingName: number;
  removedMissingPhone: number;
  finalRows: number;
  missingRating: number;
  missingMapsUrl: number;
  missingWebsite: number;
}

const STAT_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const STAT_VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-data-stack)",
  fontSize: "1.05rem",
  fontWeight: 600,
};

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div style={STAT_LABEL_STYLE}>{label}</div>
      <div style={{ ...STAT_VALUE_STYLE, color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

export default function CleaningSummary({ data }: { data: CleaningSummaryData }) {
  const rowsRemoved = data.removedMissingName + data.removedMissingPhone;

  return (
    <div
      className="rounded-[10px] border-2 p-4"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface-alt)" }}
    >
      <div style={{ ...STAT_LABEL_STYLE, marginBottom: "10px" }}>Cleaning summary</div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        <Stat label="Original Rows" value={data.totalRows} />
        <Stat label="Rows Removed" value={rowsRemoved} accent={rowsRemoved > 0} />
        <Stat label="Final Rows" value={data.finalRows} />
        <Stat label="Missing Rating" value={data.missingRating} />
        <Stat label="Missing GMap URL" value={data.missingMapsUrl} />
        <Stat label="Missing Website" value={data.missingWebsite} />
      </div>
      {rowsRemoved > 0 && (
        <div
          className="mt-3 text-[0.74rem]"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-data-stack)" }}
        >
          {data.removedMissingName} removed — missing name · {data.removedMissingPhone} removed —
          missing phone
        </div>
      )}
    </div>
  );
}
