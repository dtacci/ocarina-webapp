"use client";

import { FolderArchive } from "lucide-react";

interface Props {
  url: string | null;
  /** Aspect-correct rendering — the SVG is 80×60 so widths scale fine. */
  className?: string;
  alt?: string;
}

/**
 * Thumbnail tile for a saved capture. When the URL is present, renders the
 * SVG via <img> for native scaling + caching. When null (older captures or
 * thumbnail-upload failures), falls back to a small icon tile so library
 * rows still have a consistent left column.
 */
export function CaptureThumbnail({ url, className, alt }: Props) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt ?? "Activity heatmap"}
        loading="lazy"
        className={`shrink-0 rounded-md border border-border/60 bg-card/40 ${className ?? "h-10 w-[3.4rem]"}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/40 ${className ?? "h-10 w-[3.4rem]"}`}
    >
      <FolderArchive className="size-4 text-muted-foreground/60" />
    </span>
  );
}
