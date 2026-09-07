"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./RowdeskScreen.module.css";
import { extractDomain } from "@/lib/csv";
import { composeMessage, composeMessageHtml } from "@/lib/templates";

export type RecordStatus = "pending" | "done" | "skipped";

export interface QueueRecordDTO {
  id: string;
  rowIndex: number;
  name: string;
  phone: string | null;
  rating: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  called: boolean;
  verified: boolean;
  status: RecordStatus;
  fileName: string;
  totalInFile: number;
}

interface RowdeskScreenProps {
  initialRecord: QueueRecordDTO | null;
  initialDoneToday: number;
  templates: string[];
}

async function patchRecord(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

async function queueAction(recordId: string, action: "skip" | "done" | "next") {
  const res = await fetch("/api/queue/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, action }),
  });
  if (!res.ok) throw new Error("Failed to save");
  const data = await res.json();
  return data.record as QueueRecordDTO | null;
}

async function claimNext() {
  const res = await fetch("/api/queue/claim", { method: "POST" });
  if (!res.ok) throw new Error("Failed to claim");
  const data = await res.json();
  return data.record as QueueRecordDTO | null;
}

export default function RowdeskScreen({
  initialRecord,
  initialDoneToday,
  templates,
}: RowdeskScreenProps) {
  const [record, setRecord] = useState<QueueRecordDTO | null>(initialRecord);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [doneToday, setDoneToday] = useState(initialDoneToday);
  const [toast, setToast] = useState<React.ReactNode>(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const domain = useMemo(() => extractDomain(record?.websiteUrl ?? null), [record]);
  const template = templates[templateIndex] ?? templates[0] ?? "";
  const composedHtml = useMemo(() => composeMessageHtml(template, domain), [template, domain]);

  function showToast(node: React.ReactNode) {
    setToast(node);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function updateRecord(patch: Partial<QueueRecordDTO>) {
    setRecord((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function handleToggleCalled() {
    if (!record) return;
    const next = !record.called;
    updateRecord({ called: next });
    patchRecord(record.id, { called: next }).catch(() =>
      showToast("Couldn't save — try again")
    );
  }

  function handleToggleVerified() {
    if (!record) return;
    const next = !record.verified;
    updateRecord({ verified: next });
    if (next && record.mapsUrl) {
      window.open(record.mapsUrl, "_blank", "noopener");
    }
    patchRecord(record.id, { verified: next }).catch(() =>
      showToast("Couldn't save — try again")
    );
  }

  function handleOpenWebsite() {
    if (record?.websiteUrl) {
      window.open(record.websiteUrl, "_blank", "noopener");
    }
  }

  function handlePrevTemplate() {
    setTemplateIndex((i) => (i - 1 + templates.length) % templates.length);
  }

  function handleNextTemplate() {
    setTemplateIndex((i) => (i + 1) % templates.length);
  }

  async function handleCopy() {
    const text = composeMessage(template, domain);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Copied!");
    } catch {
      setCopyMsg("Select & Ctrl+C");
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyMsg(""), 2600);
  }

  async function runAction(action: "skip" | "done" | "next") {
    if (!record || busy) return;
    setBusy(true);
    const name = record.name;
    setCopyMsg("");

    try {
      const next = await queueAction(record.id, action);

      if (action === "done") {
        setDoneToday((d) => d + 1);
        const stamp = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        showToast(
          <>
            Done — <b>{name}</b> · you · {stamp}
          </>
        );
      } else if (action === "skip") {
        showToast(
          <>
            Skipped — <b>{name}</b>
          </>
        );
      }

      setRecord(next);
    } catch {
      showToast("Couldn't save — try again");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshQueue() {
    setBusy(true);
    try {
      const next = await claimNext();
      setRecord(next);
    } catch {
      showToast("Couldn't refresh — try again");
    } finally {
      setBusy(false);
    }
  }

  if (!record) {
    return (
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <div className={styles.wordmark}>
            <span className={styles.mark}>Rowdesk</span>
            <span className={styles.sub}>Lead Queue</span>
          </div>
          <div className={styles.topbarStats}>
            <span>
              Done today <span className={styles.doneCount}>{doneToday}</span>
            </span>
          </div>
        </div>
        <div className={styles.card} style={{ textAlign: "center", padding: "48px 22px" }}>
          <p
            style={{
              fontFamily: "var(--font-display-stack)",
              fontWeight: 800,
              fontSize: "1.15rem",
              marginBottom: "8px",
            }}
          >
            All done
          </p>
          <p style={{ color: "var(--ink-muted)", marginBottom: "20px" }}>
            No records are currently waiting for processing.
          </p>
          <button
            type="button"
            className={styles.btnNext}
            onClick={handleRefreshQueue}
            disabled={busy}
            style={{ display: "inline-block", padding: "10px 20px" }}
          >
            {busy ? "Checking…" : "Refresh Queue"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div className={styles.wordmark}>
          <span className={styles.mark}>Rowdesk</span>
          <span className={styles.sub}>Lead Queue</span>
        </div>
        <div className={styles.topbarStats}>
          <span>
            Row <b>{record.rowIndex + 1}</b> / <b>{record.totalInFile}</b>
          </span>
          <span>
            Done today <span className={styles.doneCount}>{doneToday}</span>
          </span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.fileTag}>{record.fileName}</span>
          <span className={styles.statusChip} data-status={record.status}>
            {record.status === "done"
              ? "Done"
              : record.status === "skipped"
              ? "Skipped"
              : "Processing"}
          </span>
        </div>

        <div className={`${styles.fieldRow} ${styles.split21}`}>
          <div className={styles.field}>
            <label>Name</label>
            <div className={`${styles.fieldStatic} ${styles.fieldStaticName}`}>
              {record.name}
            </div>
          </div>
          <div className={styles.field}>
            <label>Rating</label>
            <div className={`${styles.fieldStatic} ${styles.fieldStaticRating}`}>
              {record.rating != null ? (
                <>
                  ★ {record.rating.toFixed(1)} <span className={styles.outOf}>/ 5</span>
                </>
              ) : (
                <span style={{ color: "var(--ink-muted)" }}>
                  — <span className={styles.outOf}>/ 5</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`${styles.fieldRow} ${styles.split11}`}>
          <div className={styles.field}>
            <label>Phone</label>
            <div className={styles.fieldWithControl}>
              <span className={styles.val}>{record.phone ?? "—"}</span>
              <button
                type="button"
                className={styles.chipBtn}
                data-on={String(record.called)}
                onClick={handleToggleCalled}
              >
                {record.called ? "Called ✓" : "Called"}
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label>Map URL</label>
            <div className={styles.fieldWithControl}>
              <span className={styles.val}>
                {record.mapsUrl ? record.mapsUrl.replace(/^https?:\/\//, "") : "—"}
              </span>
              <button
                type="button"
                className={styles.toggleTrack}
                data-on={String(record.verified)}
                onClick={handleToggleVerified}
                disabled={!record.mapsUrl}
              >
                <span className={styles.pill} aria-hidden="true" /> Verified
              </button>
            </div>
          </div>
        </div>

        <div className={`${styles.fieldRow} ${styles.split1}`}>
          <div className={styles.field}>
            <label>Website</label>
            <div className={styles.fieldWithControl}>
              <span className={styles.val}>
                {record.websiteUrl ? record.websiteUrl.replace(/^https?:\/\//, "") : "—"}
              </span>
              <button
                type="button"
                className={styles.openBtn}
                onClick={handleOpenWebsite}
                disabled={!record.websiteUrl}
              >
                OPEN ↗
              </button>
            </div>
          </div>
        </div>

        <div className={styles.composer}>
          <div className={styles.composerLabel}>Outreach message</div>
          <p
            className={styles.composerText}
            dangerouslySetInnerHTML={{ __html: composedHtml }}
          />
          <div className={styles.composerControls}>
            <div className={styles.templateCycle}>
              <button type="button" aria-label="Previous template" onClick={handlePrevTemplate}>
                ◁
              </button>
              <span className={styles.label}>
                Template {templateIndex + 1} / {templates.length}
              </span>
              <button type="button" aria-label="Next template" onClick={handleNextTemplate}>
                ▷
              </button>
            </div>
            <div className={styles.copyStatus}>
              <span className={styles.msg}>{copyMsg}</span>
              <button type="button" className={styles.copyBtn} onClick={handleCopy}>
                Copy message
              </button>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSkip}
            onClick={() => runAction("skip")}
            disabled={busy}
          >
            Skip
          </button>
          <button
            type="button"
            className={styles.btnDone}
            onClick={() => runAction("done")}
            disabled={busy}
          >
            Done and Next Name
          </button>
          <button
            type="button"
            className={styles.btnNext}
            onClick={() => runAction("next")}
            disabled={busy}
          >
            Next Name
          </button>
        </div>

        <div className={styles.toast} aria-live="polite">
          {toast}
        </div>
      </div>

      <footer className={styles.note}>
        Called, Verified and Done states persist as you move through the queue. Records lock to
        you the moment they’re claimed.
      </footer>
    </div>
  );
}
