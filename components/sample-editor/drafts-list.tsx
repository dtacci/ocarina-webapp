"use client";

import Link from "next/link";
import { SampleCover } from "./sample-cover";
import { formatDuration, formatSampleId, timeAgo } from "@/lib/sample-editor/format";
import type { DraftRow } from "@/lib/db/queries/sample-editor";

interface Props {
  drafts: DraftRow[];
  /** When provided, clicking a row invokes the callback instead of navigating. */
  onSelect?: (draft: DraftRow) => void;
}

export function DraftsList({ drafts, onSelect }: Props) {
  if (drafts.length === 0) {
    return (
      <div className="border border-[color:var(--wb-line-soft)] px-5 py-10 text-sm text-[color:var(--ink-500)] lowercase">
        no field recordings waiting. record one above, or upload from your ocarina — it&apos;ll show up here.
      </div>
    );
  }

  return (
    <ul className="border border-[color:var(--wb-line-soft)] divide-y divide-[color:var(--wb-line-soft)]">
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function DraftRow({
  draft,
  onSelect,
}: {
  draft: DraftRow;
  onSelect?: (draft: DraftRow) => void;
}) {
  const id = formatSampleId(draft.id, "REC");
  const title = draft.title?.trim() || "untitled";
  const rowClasses =
    "group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[color:var(--ink-800)] w-full text-left";

  const inner = (
    <>
      <SampleCover
        peaks={draft.waveform_peaks}
        width={96}
        height={36}
        bars={40}
        tone="ink"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="workbench-readout text-xs text-[color:var(--ink-300)]">
            {id}
          </span>
          <span className="truncate text-sm text-[color:var(--ink-200)] lowercase">
            {title}
          </span>
        </div>
      </div>
      <div className="workbench-readout text-xs text-[color:var(--ink-500)] shrink-0 tabular-nums">
        {formatDuration(draft.duration_sec)}
      </div>
      <div className="workbench-readout text-xs text-[color:var(--ink-500)] shrink-0 w-24 text-right lowercase">
        {timeAgo(draft.created_at)}
      </div>
      <div className="workbench-readout text-xs text-[color:var(--wb-amber-dim)] shrink-0 opacity-0 transition-opacity group-hover:opacity-100 lowercase">
        edit →
      </div>
    </>
  );

  return (
    <li>
      {onSelect ? (
        <button type="button" onClick={() => onSelect(draft)} className={rowClasses}>
          {inner}
        </button>
      ) : (
        <Link href={`/sample-editor/${draft.id}`} className={rowClasses}>
          {inner}
        </Link>
      )}
    </li>
  );
}
