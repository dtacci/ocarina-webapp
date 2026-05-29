"use client";

import { useUnreadComments } from "@/hooks/use-unread-comments";

/**
 * Small emerald pill next to the sidebar's Captures item showing how many
 * comments by other users have arrived since the last visit to
 * /monitor/captures. Hidden when zero.
 */
export function CapturesUnreadBadge() {
  const { count } = useUnreadComments();
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0 font-mono text-[9px] font-medium tabular-nums text-emerald-300"
      title={`${count} new comment${count === 1 ? "" : "s"} on your captures`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
