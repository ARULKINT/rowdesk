"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./RowdeskScreen.module.css";
import { extractDomain } from "@/lib/csv";
import { composeMessage, composeMessageHtml } from "@/lib/templates";
import type { OutreachStage } from "@/lib/queue";
import type { OutreachLanguage, TemplatesByStage } from "@/lib/templateDictionary";

export type RecordStatus = "pending" | "done" | "skipped";

const STAGE_ORDER: OutreachStage[] = ["initial", "followup1", "followup2"];
const STAGE_LABEL: Record<OutreachStage, string> = {
  initial: "Initial",
  followup1: "Follow-up 1",
  followup2: "Follow-up 2",
};

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
  outreachStage: OutreachStage;
  fileName: string;
  totalInFile: number;
}

interface RowdeskScreenProps {
  initialRecord: QueueRecordDTO | null;
  initialDoneToday: number;
  templatesByStage: TemplatesByStage;
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

async function queueAction(recordId: string, action: "next" | "advance" | "skip") {
  const res = await fetch("/api/queue/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, action }),
  });
  if (!res.ok) throw new Error("Failed to save");
  const data = await res.json();
  return data.record as QueueRecordDTO | null;
}

interface PreviousResult {
  record: QueueRecordDTO | null;
  moved: boolean;
  blockedReason?: "start_of_file" | "target_done";
}

async function queuePrevious(recordId: string): Promise<PreviousResult> {
  const res = await fetch("/api/queue/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, action: "previous" }),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

async function claimNext() {
  const res = await fetch("/api/queue/claim", { method: "POST" });
  if (!res.ok) throw new Error("Failed to claim");
  const data = await res.json();
  return data.record as QueueRecordDTO | null;
}

interface MessageBoxState {
  templateIndex: number;
  copied: boolean;
}

const FRESH_BOX: MessageBoxState = { templateIndex: 0, copied: false };

export default function RowdeskScreen({
  initialRecord,
  initialDoneToday,
  templatesByStage,
}: RowdeskScreenProps) {
  const [record, setRecord] = useState<QueueRecordDTO | null>(initialRecord);
  const [box1, setBox1] = useState<MessageBoxState>(FRESH_BOX);
  const [box2, setBox2] = useState<MessageBoxState>(FRESH_BOX);
  const [doneToday, setDoneToday] = useState(initialDoneToday);
  const [toast, setToast] = useState<React.ReactNode>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stage = record?.outreachStage ?? "initial";

  // Every stage has its own pair of message slots — both boxes reset (fresh
  // language, template pick, and copy state) whenever the stage or the
  // record itself changes, so a stale "copied" flag never carries over and
  // silently unlocks Done on an outreach message the agent hasn't sent yet.
  // Adjusted during render (React's recommended pattern for resetting state
  // on prop/derived-value change) rather than in an Effect, to avoid an
  // extra commit-then-reset render pass.
  const [boxResetKey, setBoxResetKey] = useState("");
  const currentBoxKey = `${record?.id ?? ""}:${stage}`;
  if (boxResetKey !== currentBoxKey) {
    setBoxResetKey(currentBoxKey);
    setBox1(FRESH_BOX);
    setBox2(FRESH_BOX);
  }

  const domain = useMemo(() => extractDomain(record?.websiteUrl ?? null), [record]);
  const composeValues = useMemo(
    () => ({ domain, name: record?.name ?? "" }),
    [domain, record]
  );

  const templates1 = templatesByStage[stage]?.english ?? [];
  const templates2 = templatesByStage[stage]?.tamil ?? [];
  const template1 = templates1[box1.templateIndex] ?? templates1[0] ?? "";
  const template2 = templates2[box2.templateIndex] ?? templates2[0] ?? "";
  const html1 = useMemo(() => composeMessageHtml(template1, composeValues), [template1, composeValues]);
  const html2 = useMemo(() => composeMessageHtml(template2, composeValues), [template2, composeValues]);

  // A box with no template configured for its stage/language can't block
  // Done forever — treat "nothing to copy" as satisfied so a gap in the
  // template library doesn't jam the whole queue.
  const box1Ready = !template1 || box1.copied;
  const box2Ready = !template2 || box2.copied;
  const doneReady = box1Ready && box2Ready;

  function showToast(node: React.ReactNode) {
    setToast(node);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function updateRecord(patch: Partial<QueueRecordDTO>) {
    setRecord((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleCopyPhone() {
    if (!record?.phone) return;
    try {
      await navigator.clipboard.writeText(record.phone);
      setPhoneCopied(true);
    } catch {
      showToast("Couldn't copy — select & Ctrl+C");
      return;
    }
    if (phoneCopyTimer.current) clearTimeout(phoneCopyTimer.current);
    phoneCopyTimer.current = setTimeout(() => setPhoneCopied(false), 2000);
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

  function cycleTemplate(
    setBox: React.Dispatch<React.SetStateAction<MessageBoxState>>,
    count: number,
    dir: 1 | -1
  ) {
    if (count === 0) return;
    setBox((b) => ({ ...b, templateIndex: (b.templateIndex + dir + count) % count }));
  }

  async function handleCopyBox(
    setBox: React.Dispatch<React.SetStateAction<MessageBoxState>>,
    template: string
  ) {
    if (!template) return;
    const text = composeMessage(template, composeValues);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showToast("Couldn't copy — select & Ctrl+C");
    }
    setBox((b) => ({ ...b, copied: true }));
  }

  async function runAction(action: "next" | "advance" | "skip") {
    if (!record || busy) return;
    if (action === "advance" && !doneReady) return;
    setBusy(true);
    const name = record.name;
    const wasFinalStage = record.outreachStage === STAGE_ORDER[STAGE_ORDER.length - 1];

    try {
      const next = await queueAction(record.id, action);

      if (action === "advance" && wasFinalStage) {
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
      } else if (action === "advance") {
        const nextLabel = STAGE_LABEL[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]];
        showToast(
          <>
            Done — <b>{name}</b> · {nextLabel} in 3 days
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

  async function handlePrevious() {
    if (!record || busy) return;
    setBusy(true);

    try {
      const { record: next, moved, blockedReason } = await queuePrevious(record.id);
      if (!moved) {
        showToast(
          blockedReason === "target_done"
            ? "The previous row is already marked done"
            : "This is the first row in the file"
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
          <div style={{ display: "flex", gap: 6 }}>
            <span className={styles.statusChip} data-status={stage === "initial" ? "" : "followup"}>
              {STAGE_LABEL[stage]}
            </span>
            <span className={styles.statusChip} data-status={record.status}>
              {record.status === "done"
                ? "Done"
                : record.status === "skipped"
                ? "Skipped"
                : "Processing"}
            </span>
          </div>
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
                data-on={String(phoneCopied)}
                onClick={handleCopyPhone}
                disabled={!record.phone}
              >
                {phoneCopied ? "Copied ✓" : "Copy"}
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

        <div className={styles.composerGroupLabel}>{STAGE_LABEL[stage]} outreach messages</div>

        <MessageBox
          label="Message 1"
          language="english"
          box={box1}
          templates={templates1}
          template={template1}
          html={html1}
          stageLabel={STAGE_LABEL[stage]}
          onCopy={() => handleCopyBox(setBox1, template1)}
          onPrev={() => cycleTemplate(setBox1, templates1.length, -1)}
          onNext={() => cycleTemplate(setBox1, templates1.length, 1)}
        />
        <MessageBox
          label="Message 2"
          language="tamil"
          box={box2}
          templates={templates2}
          template={template2}
          html={html2}
          stageLabel={STAGE_LABEL[stage]}
          onCopy={() => handleCopyBox(setBox2, template2)}
          onPrev={() => cycleTemplate(setBox2, templates2.length, -1)}
          onNext={() => cycleTemplate(setBox2, templates2.length, 1)}
        />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnNext}
            onClick={handlePrevious}
            disabled={busy || record.rowIndex === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className={styles.btnNext}
            onClick={() => runAction("skip")}
            disabled={busy}
            title="Send this record back to the shared queue for anyone to pick up later"
          >
            Skip
          </button>
          <button
            type="button"
            className={styles.btnDone}
            onClick={() => runAction("advance")}
            disabled={busy || !doneReady}
            title={
              !doneReady
                ? "Copy both outreach messages first"
                : stage === "followup2"
                ? "Marks this record fully done"
                : `Schedules ${STAGE_LABEL[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]]} in 3 days`
            }
          >
            {stage === "followup2" ? "Done — Complete" : "Done and Next Name"}
          </button>
          <button
            type="button"
            className={styles.btnNext}
            onClick={() => runAction("next")}
            disabled={busy}
          >
            Next
          </button>
        </div>

        <div className={styles.toast} aria-live="polite">
          {toast}
        </div>
      </div>

      <footer className={styles.note}>
        Verified and Done states persist as you move through the queue. Records lock to you the
        moment they’re claimed.
      </footer>
    </div>
  );
}

function MessageBox({
  label,
  language,
  box,
  templates,
  template,
  html,
  stageLabel,
  onCopy,
  onPrev,
  onNext,
}: {
  label: string;
  language: OutreachLanguage;
  box: MessageBoxState;
  templates: string[];
  template: string;
  html: string;
  stageLabel: string;
  onCopy: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const languageLabel = language === "english" ? "English" : "தமிழ் Tamil";
  return (
    <div className={styles.composer}>
      <div className={styles.composerLabel}>
        {label} <span className={styles.langBadge}>{languageLabel}</span>
      </div>
      {template ? (
        <p className={styles.composerText} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className={styles.composerText} style={{ color: "var(--ink-muted)" }}>
          No {stageLabel.toLowerCase()} template in {language === "english" ? "English" : "Tamil"} yet
          — add one in Admin → Templates.
        </p>
      )}
      <div className={styles.composerControls}>
        <div className={styles.templateCycle}>
          <button type="button" aria-label={`Previous ${label} template`} onClick={onPrev} disabled={templates.length < 2}>
            ◁
          </button>
          <span className={styles.label}>
            Template {templates.length === 0 ? 0 : box.templateIndex + 1} / {templates.length}
          </span>
          <button type="button" aria-label={`Next ${label} template`} onClick={onNext} disabled={templates.length < 2}>
            ▷
          </button>
        </div>
        <div className={styles.copyStatus}>
          <button
            type="button"
            className={styles.copyBtn}
            data-on={String(box.copied)}
            onClick={onCopy}
            disabled={!template}
          >
            {box.copied ? "Copied ✓" : "Copy message"}
          </button>
        </div>
      </div>
    </div>
  );
}
