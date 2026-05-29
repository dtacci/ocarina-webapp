"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "ocarina-comments-seen-at-v1";
const POLL_MS = 60_000;

interface RecentComment {
  id: string;
  created_at: string;
}

/**
 * Polls /api/comments/recent and compares against a localStorage "last seen"
 * cursor to count unread comments on the user's captures. `markAllSeen` resets
 * the cursor — the sidebar badge calls it when the user lands on
 * /monitor/captures.
 */
export function useUnreadComments(): { count: number; markAllSeen: () => void } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let seenAt = readSeen();

    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/comments/recent", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { comments: RecentComment[] };
        if (cancelled) return;
        seenAt = readSeen();
        const unread = body.comments.filter(
          (c) => new Date(c.created_at).getTime() > seenAt
        ).length;
        setCount(unread);
      } catch {
        // Silent — the badge just doesn't update.
      }
    };

    void fetchOnce();
    const iv = setInterval(fetchOnce, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const markAllSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      setCount(0);
    } catch {
      // ignore
    }
  };

  return { count, markAllSeen };
}

function readSeen(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) {
      // First visit ever — treat as "everything before now is seen" so we
      // don't surface a wall of historical comments on first install.
      const now = Date.now();
      window.localStorage.setItem(SEEN_KEY, String(now));
      return now;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}
