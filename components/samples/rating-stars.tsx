"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { setRating } from "@/app/(dashboard)/library/actions";
import { cn } from "@/lib/utils";

interface Props {
  sampleId: string;
  initialRating: number | null;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({
  sampleId,
  initialRating,
  size = "sm",
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    initialRating,
    (_current, next: number | null) => next
  );

  const iconSize = size === "md" ? "size-5" : "size-3.5";
  const displayed = hover ?? optimistic ?? 0;

  function handleClick(e: React.MouseEvent, n: number) {
    e.preventDefault();
    e.stopPropagation();
    const next = optimistic === n ? null : n;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setRating(sampleId, next);
      } catch {
        // Optimistic value reverts automatically when the transition rejects.
      }
    });
  }

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      onMouseLeave={() => setHover(null)}
      aria-label={optimistic ? `Rated ${optimistic} of 5` : "Not rated"}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= displayed;
        return (
          <button
            key={n}
            type="button"
            onClick={(e) => handleClick(e, n)}
            onMouseEnter={() => setHover(n)}
            disabled={isPending}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={cn(
              "rounded p-0.5 transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:opacity-60"
            )}
          >
            <Star
              className={cn(
                iconSize,
                "transition-colors",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
