"use client";

import { useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { kitBuilderSchema } from "@/lib/ai/kit-builder-schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check } from "lucide-react";

const slotColors = [
  "border-violet-500 bg-violet-50 dark:bg-violet-950/30",
  "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
  "border-pink-500 bg-pink-50 dark:bg-pink-950/30",
  "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
];

const suggestions = [
  "rainy late-night jazz session",
  "epic orchestral battle scene",
  "chill lo-fi study beats",
  "80s synth-pop dance party",
  "intimate acoustic coffee shop",
  "dark ambient horror soundtrack",
];

interface StreamingSlot {
  name?: string;
  family?: string;
  vibes?: (string | undefined)[];
  reasoning?: string;
  optional?: boolean;
}

function SlotCard({ slot, index }: { slot: StreamingSlot; index: number }) {
  const colorClass = slotColors[index % slotColors.length];
  const vibes = slot.vibes?.filter((v): v is string => !!v) ?? [];

  return (
    <div className={`rounded-lg border-l-4 p-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${colorClass}`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium capitalize">{slot.name || "..."}</h3>
        <div className="flex items-center gap-1.5">
          {slot.family && (
            <Badge variant="secondary" className="text-xs">{slot.family}</Badge>
          )}
          {slot.optional && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">optional</Badge>
          )}
        </div>
      </div>
      {slot.reasoning && (
        <p className="text-sm text-muted-foreground mb-2">{slot.reasoning}</p>
      )}
      {vibes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {vibes.map((v) => (
            <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">{v}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function KitBuilderForm() {
  const [description, setDescription] = useState("");

  const { object, submit, isLoading, stop } = useObject({
    api: "/api/ai/kit-builder",
    schema: kitBuilderSchema,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    submit({ description: description.trim() });
  }

  function handleSuggestion(s: string) {
    setDescription(s);
    submit({ description: s });
  }

  const isComplete = object?.slots && object.slots.length > 0 && !isLoading;

  return (
    <div className="space-y-6">
      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your perfect kit..."
            className="pl-8"
            disabled={isLoading}
          />
        </div>
        {isLoading ? (
          <Button type="button" variant="outline" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!description.trim()}>
            Build Kit
          </Button>
        )}
      </form>

      {/* Suggestions */}
      {!object && !isLoading && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Streaming result */}
      {(object || isLoading) && (
        <div className="space-y-4">
          {/* Kit header */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              {isLoading && !object?.name && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <h2 className="text-lg font-semibold">
                {object?.name || "Building..."}
              </h2>
              {isComplete && <Check className="size-4 text-emerald-500" />}
            </div>
            {object?.description && (
              <p className="text-sm text-muted-foreground">{object.description}</p>
            )}
            {object?.vibes && object.vibes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {object.vibes.map((v: string | undefined, i: number) => v && (
                  <Badge key={`${v}-${i}`} variant="outline">{v}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Slots streaming in */}
          <div className="space-y-3">
            {object?.slots?.map((slot, i: number) => slot && (
              <SlotCard key={i} slot={slot as StreamingSlot} index={i} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-4">
                <Loader2 className="size-3 animate-spin" />
                <span>Building slot {(object?.slots?.length || 0) + 1}...</span>
              </div>
            )}
          </div>

          {/* Keyboard map */}
          {object?.keyboardMap && Object.keys(object.keyboardMap).length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium mb-2">Keyboard Layout</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(object.keyboardMap).map(([keys, slot]: [string, unknown]) => (
                  <div key={keys} className="flex items-center justify-between rounded bg-muted px-2 py-1">
                    <code className="text-xs font-mono">{keys}</code>
                    <span className="text-muted-foreground capitalize">{String(slot)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
