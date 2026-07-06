import { notFound, redirect } from "next/navigation";
import { getSample } from "@/lib/db/queries/samples";
import { getRecordingForEditor } from "@/lib/db/queries/sample-editor";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "@/components/sample-editor/editor";

interface Props {
  params: Promise<{ sampleId: string }>;
}

export default async function SampleEditorRoute({ params }: Props) {
  const { sampleId } = await params;
  const decodedId = decodeURIComponent(sampleId);

  const supabase = await createClient();
  const [sample, userResp] = await Promise.all([
    getSample(decodedId),
    supabase.auth.getUser(),
  ]);

  if (!userResp.data.user) redirect("/login");

  // Sample editor URLs may also point at a `recordings` row (drafts loaded
  // inline from the workshop floor, or the /recordings modal "open in editor"
  // shortcut). Fall back to that table when the id isn't a saved sample.
  const target = sample ?? (await getRecordingForEditor(decodedId));
  if (!target) notFound();

  return (
    <Editor
      mode="persistent"
      sample={target}
      currentUserId={userResp.data.user.id}
    />
  );
}
