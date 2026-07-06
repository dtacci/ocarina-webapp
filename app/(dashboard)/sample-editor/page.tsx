import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUserDrafts,
  getUserEdits,
  getUserOwnedSamples,
} from "@/lib/db/queries/sample-editor";
import { EditorWorkshop } from "@/components/sample-editor/editor-workshop";

export default async function SampleEditorPage() {
  const supabase = await createClient();
  const [{ data: userResp }, drafts, samples, edits] = await Promise.all([
    supabase.auth.getUser(),
    getUserDrafts(20),
    getUserOwnedSamples(24),
    getUserEdits(10),
  ]);

  if (!userResp.user) redirect("/login");

  return (
    <div className="workbench -m-6 min-h-[calc(100vh-3.5rem)] p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="workbench-heading text-4xl">sample editor</h1>
          <p className="text-sm text-[color:var(--ink-500)] lowercase">
            record, sculpt, and bake samples — all on one bench.
          </p>
        </header>

        <EditorWorkshop
          currentUserId={userResp.user.id}
          drafts={drafts}
          samples={samples}
          edits={edits}
        />
      </div>
    </div>
  );
}
