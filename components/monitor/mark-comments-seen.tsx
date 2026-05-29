"use client";

import { useEffect } from "react";

import { useUnreadComments } from "@/hooks/use-unread-comments";

/**
 * Headless effect — call useUnreadComments().markAllSeen() on mount so opening
 * the Captures library resets the sidebar badge. Renders nothing.
 */
export function MarkCommentsSeen() {
  const { markAllSeen } = useUnreadComments();
  useEffect(() => {
    markAllSeen();
    // Run once per page mount; the hook will re-poll in the background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
