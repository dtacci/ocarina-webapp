"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleKaraokeFavorite } from "@/app/(dashboard)/karaoke/actions";
import { cn } from "@/lib/utils";

interface Props {
  songId: string;
  initialFavorite: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function KaraokeFavoriteButton({
  songId,
  initialFavorite,
  size = "sm",
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    initialFavorite,
    (_current, next: boolean) => next
  );

  const iconSize = size === "md" ? "size-5" : "size-4";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await toggleKaraokeFavorite(songId, next);
      } catch {
        // Optimistic value reverts automatically when the transition rejects.
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
      disabled={isPending}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1 transition-colors",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:opacity-60",
        className
      )}
    >
      <Heart
        className={cn(
          iconSize,
          "transition-colors",
          optimistic
            ? "fill-primary text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      />
    </button>
  );
}
