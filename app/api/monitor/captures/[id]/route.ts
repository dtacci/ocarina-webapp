import { z } from "zod";
import { del } from "@vercel/blob";

import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().min(1).max(120),
});

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

  const { data, error } = await supabase
    .from("monitor_captures")
    .update({ name: parsed.data.name })
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

  // Fetch first so we know which blob to clean up after the row delete.
  const { data: row } = await supabase
    .from("monitor_captures")
    .select("blob_url")
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

  // Best-effort blob cleanup. If this fails the row is already gone and the
  // user is unblocked; orphan blob is a separate sweep problem.
  try {
    await del(row.blob_url);
  } catch (err) {
    console.warn("blob delete failed for capture", id, err);
  }

  return Response.json({ ok: true });
}
