"use client";

import Link from "next/link";
import { SampleCover } from "./sample-cover";
import { formatDuration, formatSampleId } from "@/lib/sample-editor/format";
import type { UserSampleRow } from "@/lib/db/queries/sample-editor";

interface Props {
  samples: UserSampleRow[];
  /** When provided, clicking a tile invokes the callback instead of navigating. */
  onSelect?: (sample: UserSampleRow) => void;
}

export function SamplesGrid({ samples, onSelect }: Props) {
  if (samples.length === 0) {
    return (
      <div className="border border-[color:var(--wb-line-soft)] px-5 py-10 text-sm text-[color:var(--ink-500)] lowercase">
        no user samples yet. edits save here once you&apos;re done polishing.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {samples.map((s) => (
        <SampleCell key={s.id} sample={s} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function SampleCell({
  sample,
  onSelect,
}: {
  sample: UserSampleRow;
  onSelect?: (sample: UserSampleRow) => void;
}) {
  const trimmedTitle = sample.title?.trim();
  const displayLabel =
    trimmedTitle && trimmedTitle.length > 0
      ? trimmedTitle.toLowerCase()
      : formatSampleId(sample.id, sample.source_sample_id ? "SE" : "SMP");
  const cellClasses =
    "group block w-full text-left border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-800)] transition-colors hover:border-[color:var(--wb-amber-dim)]";

  const inner = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden">
        <SampleCover
          peaks={sample.waveform_peaks}
          width={200}
          height={140}
          bars={48}
          tone="amber"
          className="h-full w-full"
        />
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-[color:var(--ink-900)]/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <span className="workbench-readout mb-2 text-xs text-[color:var(--wb-amber)] lowercase">
            re-edit →
          </span>
        </div>
      </div>
      <div
        className="flex items-baseline justify-between border-t border-[color:var(--wb-line-soft)] px-3 py-2"
        title={displayLabel}
      >
        <span className="workbench-readout text-[10px] text-[color:var(--ink-300)] truncate">
          {displayLabel}
        </span>
        <span className="workbench-readout text-[10px] text-[color:var(--ink-500)] tabular-nums shrink-0 ml-2">
          {formatDuration(sample.duration_sec)}
        </span>
      </div>
    </>
  );

  return (
    <li>
      {onSelect ? (
        <button type="button" onClick={() => onSelect(sample)} className={cellClasses}>
          {inner}
        </button>
      ) : (
        <Link href={`/sample-editor/${sample.id}`} className={cellClasses}>
          {inner}
        </Link>
      )}
    </li>
  );
}
