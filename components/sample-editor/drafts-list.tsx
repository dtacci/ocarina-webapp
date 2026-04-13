import Link from "next/link";
import { SampleCover } from "./sample-cover";
import { formatDuration, formatSampleId, timeAgo } from "@/lib/sample-editor/format";
import type { DraftRow } from "@/lib/db/queries/sample-editor";

interface Props {
  drafts: DraftRow[];
}

export function DraftsList({ drafts }: Props) {
  if (drafts.length === 0) {
    return (
      <div className="border border-[color:var(--wb-line-soft)] px-5 py-10 text-sm text-[color:var(--ink-500)] lowercase">
        no field recordings waiting. record something on your ocarina — it&apos;ll show up here.
      </div>
    );
  }

  return (
    <ul className="border border-[color:var(--wb-line-soft)] divide-y divide-[color:var(--wb-line-soft)]">
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} />
      ))}
    </ul>
  );
}

function DraftRow({ draft }: { draft: DraftRow }) {
  const id = formatSampleId(draft.id, "REC");
  const title = draft.title?.trim() || "untitled";
  return (
    <li>
      <Link
        href={`/sample-editor/${draft.id}`}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[color:var(--ink-800)]"
      >
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
      </Link>
    </li>
  );
}
