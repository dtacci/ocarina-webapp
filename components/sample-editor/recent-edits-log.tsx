import Link from "next/link";
import { formatSampleId, timeAgo } from "@/lib/sample-editor/format";
import type { EditLogRow } from "@/lib/db/queries/sample-editor";

interface Props {
  edits: EditLogRow[];
}

export function RecentEditsLog({ edits }: Props) {
  if (edits.length === 0) {
    return (
      <div className="border border-[color:var(--wb-line-soft)] px-5 py-6 workbench-readout text-xs text-[color:var(--ink-500)] lowercase">
        no edits yet.
      </div>
    );
  }

  return (
    <ul className="border border-[color:var(--wb-line-soft)] divide-y divide-[color:var(--wb-line-soft)]">
      {edits.map((row) => (
        <li
          key={row.id}
          className="flex items-center gap-4 px-4 py-2 workbench-readout text-xs"
        >
          <Link
            href={`/sample-editor/${row.id}`}
            className="text-[color:var(--ink-300)] hover:text-[color:var(--wb-amber)] transition-colors"
          >
            {formatSampleId(row.id, "SE")}
          </Link>
          <span className="text-[color:var(--ink-500)] lowercase">
            ← edited from
          </span>
          <Link
            href={`/library/${row.source_sample_id}`}
            className="text-[color:var(--ink-300)] hover:text-[color:var(--wb-amber)] transition-colors"
          >
            {formatSampleId(row.source_sample_id)}
          </Link>
          <span className="ml-auto text-[color:var(--ink-500)] lowercase">
            {timeAgo(row.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
