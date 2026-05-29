import { listRecentCommentsOnMyCaptures } from "@/lib/db/queries/capture-comments";

export const dynamic = "force-dynamic";

/**
 * Authenticated JSON feed of recent comments on the caller's captures. Used
 * by the sidebar unread badge (compares against a localStorage cursor) and
 * available to any external consumer that wants notification-style activity.
 *
 * Excludes the caller's own comments — only external thread activity.
 */
export async function GET() {
  const comments = await listRecentCommentsOnMyCaptures(30);
  return Response.json({
    comments: comments.map((c) => ({
      id: c.id,
      capture_id: c.capture_id,
      capture_name: c.capture_name,
      author_id: c.author_id,
      author_display_name: c.author_display_name,
      body: c.body,
      created_at: c.created_at,
    })),
  });
}
