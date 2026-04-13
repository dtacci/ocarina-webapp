import { notFound, redirect } from "next/navigation";
import { getSample } from "@/lib/db/queries/samples";
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
  if (!sample) notFound();

  return <Editor sample={sample} currentUserId={userResp.data.user.id} />;
}
