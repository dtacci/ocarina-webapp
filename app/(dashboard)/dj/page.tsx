import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDjSources, type DjSource } from "@/lib/db/queries/dj";
import { DjClient } from "@/components/dj/dj-client";

export const metadata = {
  title: "DJ Decks — Digital Ocarina",
};

interface Props {
  searchParams: Promise<{ load?: string; kind?: string; deck?: string }>;
}

/**
 * `?load=<id>&kind=recording|sample&deck=a|b` auto-loads a track into a deck
 * — the handoff target for "load into DJ deck" buttons on sample cards and
 * recording rows. Resolved server-side so the deck can load things that
 * aren't in the browser list (e.g. system library samples).
 */
async function resolveAutoload(
  params: Awaited<Props["searchParams"]>,
  userId: string,
): Promise<{ source: DjSource; deck: "a" | "b" } | null> {
  const { load, kind, deck } = params;
  if (!load) return null;
  const supabase = await createClient();

  if (kind === "sample") {
    const { data: s } = await supabase
      .from("samples")
      .select("id,title,blob_url,duration_sec,bpm,user_id,is_system")
      .eq("id", load)
      .maybeSingle();
    if (!s?.blob_url?.startsWith("http")) return null;
    if (!s.is_system && s.user_id !== userId) return null;
    return {
      source: {
        id: s.id,
        kind: "sample",
        title: s.title ?? s.id,
        durationSec: s.duration_sec ?? 0,
        bpm: s.bpm ?? null,
        url: s.blob_url,
        recordingType: null,
      },
      deck: deck === "b" ? "b" : "a",
    };
  }

  const { data: r } = await supabase
    .from("recordings")
    .select("id,title,blob_url,duration_sec,bpm,recording_type,user_id")
    .eq("id", load)
    .eq("user_id", userId)
    .maybeSingle();
  if (!r?.blob_url?.startsWith("http")) return null;
  return {
    source: {
      id: r.id,
      kind: "recording",
      title: r.title ?? "Untitled recording",
      durationSec: r.duration_sec ?? 0,
      bpm: r.bpm,
      url: r.blob_url,
      recordingType: r.recording_type,
    },
    deck: deck === "b" ? "b" : "a",
  };
}

export default async function DjPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const [sources, autoload] = await Promise.all([
    getDjSources(),
    resolveAutoload(params, user.id),
  ]);
  return <DjClient sources={sources} autoload={autoload} />;
}
