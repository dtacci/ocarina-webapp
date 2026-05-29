import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("capture_comments")
    .insert({
      capture_id: id,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id, capture_id, author_id, body, created_at, users:author_id(display_name)")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "Insert failed", detail: error?.message ?? "no row" },
      { status: 400 }
    );
  }
  const row = data as Record<string, unknown>;
  return Response.json({
    comment: {
      id: row.id,
      capture_id: row.capture_id,
      author_id: row.author_id,
      body: row.body,
      created_at: row.created_at,
      author_display_name:
        (row.users as { display_name?: string | null } | null)?.display_name ?? null,
    },
  });
}
