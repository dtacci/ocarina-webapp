import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CaptureCommentRow {
  id: string;
  capture_id: string;
  author_id: string;
  body: string;
  created_at: string;
  /** Joined from users table — author's display_name when set, null otherwise. */
  author_display_name?: string | null;
}

/**
 * Comments visible to the current user — RLS scopes the result to comments on
 * their own captures plus comments on captures with is_public=true.
 */
export async function listCommentsForCapture(
  captureId: string
): Promise<CaptureCommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("capture_comments")
    .select("id, capture_id, author_id, body, created_at, users:author_id(display_name)")
    .eq("capture_id", captureId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    capture_id: row.capture_id as string,
    author_id: row.author_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author_display_name:
      (row.users as { display_name?: string | null } | null)?.display_name ?? null,
  }));
}

export interface RecentCommentRow extends CaptureCommentRow {
  capture_name: string;
}

/**
 * Comments left on the current user's captures by anyone — used by /activity
 * "Recent Comments" + the sidebar notification badge. Skips the user's own
 * comments so the feed only shows external activity.
 */
export async function listRecentCommentsOnMyCaptures(
  limit = 30
): Promise<RecentCommentRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: ownedCaptures } = await supabase
    .from("monitor_captures")
    .select("id, name")
    .eq("user_id", user.id);
  const captures = (ownedCaptures ?? []) as { id: string; name: string }[];
  if (captures.length === 0) return [];

  const captureIds = captures.map((c) => c.id);
  const nameById = new Map(captures.map((c) => [c.id, c.name]));

  const { data } = await supabase
    .from("capture_comments")
    .select("id, capture_id, author_id, body, created_at, users:author_id(display_name)")
    .in("capture_id", captureIds)
    .neq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    capture_id: row.capture_id as string,
    capture_name: nameById.get(row.capture_id as string) ?? "",
    author_id: row.author_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author_display_name:
      (row.users as { display_name?: string | null } | null)?.display_name ?? null,
  }));
}

/**
 * Anonymous-readable comment list for a publicly-shared capture, looked up by
 * token. Bypasses RLS via the admin client after a server-side `is_public`
 * check so revoking sharing immediately closes the thread to non-owners.
 */
export async function listPublicCommentsByToken(
  token: string
): Promise<CaptureCommentRow[] | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data: capture } = await admin
    .from("monitor_captures")
    .select("id")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();
  if (!capture) return null;

  const { data } = await admin
    .from("capture_comments")
    .select("id, capture_id, author_id, body, created_at, users:author_id(display_name)")
    .eq("capture_id", (capture as { id: string }).id)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    capture_id: row.capture_id as string,
    author_id: row.author_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author_display_name:
      (row.users as { display_name?: string | null } | null)?.display_name ?? null,
  }));
}
