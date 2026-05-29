"use client";

import { useLooperActive } from "@/hooks/use-looper-active";

/**
 * Recording pulse on the Looper sidebar item. Red ping when at least one
 * track is recording; otherwise hidden. Lightweight 60s poll only — no
 * permanent WS connection from the sidebar.
 */
export function LooperActiveBadge() {
  const { isRecording, hasActiveLoop } = useLooperActive();
  if (!isRecording && !hasActiveLoop) return null;
  return (
    <span
      className="ml-auto flex items-center"
      title={isRecording ? "Recording" : "Loop active"}
    >
      <span className="relative flex size-2">
        {isRecording && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500/80" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${
            isRecording ? "bg-red-500" : "bg-emerald-500/80"
          }`}
        />
      </span>
    </span>
  );
}
