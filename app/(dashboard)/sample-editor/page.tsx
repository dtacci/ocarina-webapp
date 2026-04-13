import {
  getUserDrafts,
  getUserEdits,
  getUserOwnedSamples,
} from "@/lib/db/queries/sample-editor";
import { DraftsList } from "@/components/sample-editor/drafts-list";
import { SamplesGrid } from "@/components/sample-editor/samples-grid";
import { RecentEditsLog } from "@/components/sample-editor/recent-edits-log";

export default async function SampleEditorPage() {
  const [drafts, samples, edits] = await Promise.all([
    getUserDrafts(20),
    getUserOwnedSamples(24),
    getUserEdits(10),
  ]);

  const draftCount = drafts.length;
  const draftHeader =
    draftCount === 0
      ? "drafts · no recordings awaiting edit"
      : `drafts · ${draftCount} ${draftCount === 1 ? "recording" : "recordings"} awaiting edit`;

  return (
    <div className="workbench -m-6 min-h-[calc(100vh-3.5rem)] p-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-2">
          <h1 className="workbench-heading text-4xl">sample editor</h1>
          <p className="text-sm text-[color:var(--ink-500)] lowercase">
            refine field recordings into finished samples.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="workbench-label">{draftHeader}</h2>
          <DraftsList drafts={drafts} />
        </section>

        <section className="space-y-4">
          <h2 className="workbench-label">your samples · saved to library</h2>
          <SamplesGrid samples={samples} />
        </section>

        <section className="space-y-4">
          <h2 className="workbench-label">recent edits</h2>
          <RecentEditsLog edits={edits} />
        </section>
      </div>
    </div>
  );
}
