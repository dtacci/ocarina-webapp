import { createClient } from "@/lib/supabase/server";
import type { SessionMixDoc } from "@/lib/audio/mix-types";

export interface SessionMixRow extends SessionMixDoc {
  id: string;
  sessionId: string;
  updatedAt: string;
}

/** Most recently updated mix for a session (RLS scopes to the owner). */
export async function getSessionMix(sessionId: string): Promise<SessionMixRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_mixes")
    .select("id,session_id,name,channels,master,updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    channels: (data.channels as SessionMixDoc["channels"]) ?? [],
    master: (data.master as SessionMixDoc["master"]) ?? { volume: 1 },
    updatedAt: data.updated_at,
  };
}

/** Create-or-update the named mix for a session. Returns the row id. */
export async function upsertSessionMix(
  sessionId: string,
  doc: SessionMixDoc,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("session_mixes")
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        name: doc.name,
        channels: doc.channels,
        master: doc.master,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,name" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}
