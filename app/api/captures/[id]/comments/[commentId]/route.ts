import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string; commentId: string }>;
}

/**
 * Delete a single comment. RLS allows the comment's author OR the capture
 * owner to remove it, so the supabase server client is enough — no extra
 * server-side ownership check needed.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id, commentId } = await params;

  const { error, count } = await supabase
    .from("capture_comments")
    .delete({ count: "exact" })
    .eq("id", commentId)
    .eq("capture_id", id);

  if (error) {
    return Response.json({ error: "Delete failed", detail: error.message }, { status: 400 });
  }
  if (!count) {
    return Response.json({ error: "Not found or not permitted" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
