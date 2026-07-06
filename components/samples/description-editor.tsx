"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  sampleId: string;
  initialText: string | null;
  /** 'llm:<model>' | 'human' | null when no description exists yet */
  initialSource: string | null;
}

/**
 * Canonical sample description with inline editing. Edits create a new
 * human-sourced row whose parent is the LLM proposal — those chains are the
 * fine-tune pairs the ML roadmap depends on, so every edit counts.
 */
export function DescriptionEditor({ sampleId, initialText, initialSource }: Props) {
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState(initialSource);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!text && !editing) {
    return null; // no description generated yet — nothing to show or edit
  }

  async function save() {
    if (draft.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/samples/${encodeURIComponent(sampleId)}/description`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: draft.trim() }),
        },
      );
      if (res.ok) {
        setText(draft.trim());
        setSource("human");
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Description</h2>
        {source?.startsWith("llm:") && (
          <Badge variant="outline" className="text-[10px]">AI-generated</Badge>
        )}
        {source === "human" && (
          <Badge variant="secondary" className="text-[10px]">edited</Badge>
        )}
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 ml-auto"
            onClick={() => {
              setDraft(text ?? "");
              setEditing(true);
            }}
            title="Improve this description"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border bg-background p-2 text-sm"
            disabled={saving}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              <X className="size-3.5" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving || draft.trim().length < 10}
            >
              <Check className="size-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
