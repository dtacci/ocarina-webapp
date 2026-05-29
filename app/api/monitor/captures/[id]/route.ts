import { z } from "zod";
import { del } from "@vercel/blob";

import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(8000).nullable().optional(),
  isPublic: z.boolean().optional(),
  /** Set true to mint a fresh share_token (invalidates any existing share link). */
  rotateToken: z.boolean().optional(),
}).refine(
  (v) =>
    v.name !== undefined ||
    v.notes !== undefined ||
    v.isPublic !== undefined ||
    v.rotateToken !== undefined,
  { message: "Provide at least one field to update" }
);

function generateShareToken(): string {
  // 16 random bytes → 22-char base64url. URL-safe, unguessable, plenty short.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  // Share toggle: enabling needs a token (mint one if missing); disabling
  // leaves the token in place so re-enabling resumes the same link unless
  // rotate is requested. Rotating mints a fresh token regardless of state.
  if (parsed.data.isPublic !== undefined || parsed.data.rotateToken) {
    const { data: current } = await supabase
      .from("monitor_captures")
      .select("share_token, is_public")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!current) return Response.json({ error: "Not found" }, { status: 404 });

    if (parsed.data.isPublic !== undefined) patch.is_public = parsed.data.isPublic;
    if (parsed.data.rotateToken) {
      patch.share_token = generateShareToken();
    } else if (parsed.data.isPublic === true && !current.share_token) {
      patch.share_token = generateShareToken();
    }
  }

  const { data, error } = await supabase
    .from("monitor_captures")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ capture: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  // Fetch first so we know which blobs to clean up after the row delete.
  const { data: row } = await supabase
    .from("monitor_captures")
    .select("blob_url, thumbnail_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: delErr } = await supabase
    .from("monitor_captures")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (delErr) {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }

  // Best-effort blob cleanup — JSON payload + thumbnail SVG. If either fails
  // the row is already gone and the user is unblocked; orphan blob is a
  // separate sweep problem.
  const orphans = [row.blob_url, row.thumbnail_url].filter(
    (u): u is string => typeof u === "string" && u.length > 0
  );
  await Promise.all(
    orphans.map(async (u) => {
      try { await del(u); } catch (err) { console.warn("blob delete failed", id, u, err); }
    })
  );

  return Response.json({ ok: true });
}
