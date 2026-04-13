"use client";

/**
 * Metadata form — collapsible panel at the bottom of the editor.
 *
 * Captures the fields that live on the `samples` row: name, root note,
 * family, category, attribute bars (1–10), vibes tags. Owned by the editor,
 * hydrated from the source sample, submitted with save.
 */

import { useState, type KeyboardEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { Dropdown } from "./primitives/dropdown";
import { LinearSlider } from "./primitives/linear-slider";

export type SampleFamily =
  | "strings"
  | "brass"
  | "woodwind"
  | "keys"
  | "mallet"
  | "drums"
  | "guitar"
  | "other_perc"
  | "other"
  | "fx";

export type SampleCategory = "acoustic" | "percussion" | "fx";

export interface SampleMetadata {
  name: string;
  family: SampleFamily | "";
  category: SampleCategory | "";
  rootNote: string;
  brightness: number;
  attack: number;
  sustain: number;
  texture: number;
  warmth: number;
  vibes: string[];
}

interface Props {
  metadata: SampleMetadata;
  onChange: (patch: Partial<SampleMetadata>) => void;
}

const FAMILY_OPTIONS = [
  { value: "", label: "—" },
  { value: "strings", label: "strings" },
  { value: "brass", label: "brass" },
  { value: "woodwind", label: "woodwind" },
  { value: "keys", label: "keys" },
  { value: "mallet", label: "mallet" },
  { value: "drums", label: "drums" },
  { value: "guitar", label: "guitar" },
  { value: "other_perc", label: "other perc" },
  { value: "other", label: "other" },
  { value: "fx", label: "fx" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "", label: "—" },
  { value: "acoustic", label: "acoustic" },
  { value: "percussion", label: "percussion" },
  { value: "fx", label: "fx" },
] as const;

const NOTE_LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOT_NOTE_OPTIONS = [
  { value: "", label: "—" },
  ...Array.from({ length: 5 }, (_, oct) =>
    NOTE_LETTERS.map((l) => ({ value: `${l}${oct + 2}`, label: `${l}${oct + 2}` })),
  ).flat(),
];

export function MetadataPanel({ metadata, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [vibeInput, setVibeInput] = useState("");

  const handleVibeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const raw = vibeInput.trim().toLowerCase();
      if (!raw) return;
      if (metadata.vibes.includes(raw)) return;
      if (metadata.vibes.length >= 20) return;
      onChange({ vibes: [...metadata.vibes, raw] });
      setVibeInput("");
    } else if (e.key === "Backspace" && !vibeInput && metadata.vibes.length > 0) {
      onChange({ vibes: metadata.vibes.slice(0, -1) });
    }
  };

  const removeVibe = (v: string) => {
    onChange({ vibes: metadata.vibes.filter((x) => x !== v) });
  };

  return (
    <section className="border border-[color:var(--wb-line)] bg-[color:var(--ink-800)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[color:var(--ink-700)]/40 transition-colors"
      >
        <h2 className="workbench-label">metadata</h2>
        <span className="workbench-readout text-[10px] text-[color:var(--ink-500)] lowercase ml-auto">
          {metadata.name || "untitled"}
          {metadata.rootNote && ` · ${metadata.rootNote.toLowerCase()}`}
          {metadata.family && ` · ${metadata.family}`}
        </span>
        <ChevronDown
          className="size-3.5 text-[color:var(--ink-500)] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        />
      </button>

      {expanded && (
        <div className="border-t border-[color:var(--wb-line-soft)] p-5 space-y-5">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="workbench-label" htmlFor="sample-name">
              name
            </label>
            <input
              id="sample-name"
              type="text"
              value={metadata.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="untitled"
              maxLength={120}
              className="workbench-readout text-sm px-2 py-1.5 border border-[color:var(--wb-line)] bg-[color:var(--ink-900)] text-[color:var(--ink-200)] placeholder:text-[color:var(--ink-600)] focus:border-[color:var(--wb-amber-dim)] focus:outline-none lowercase"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex flex-wrap gap-4">
            <Dropdown
              label="root note"
              value={metadata.rootNote}
              options={ROOT_NOTE_OPTIONS}
              onChange={(v) => onChange({ rootNote: v })}
            />
            <Dropdown
              label="family"
              value={metadata.family}
              options={FAMILY_OPTIONS}
              onChange={(v) => onChange({ family: v as SampleFamily | "" })}
            />
            <Dropdown
              label="category"
              value={metadata.category}
              options={CATEGORY_OPTIONS}
              onChange={(v) => onChange({ category: v as SampleCategory | "" })}
            />
          </div>

          {/* Attribute bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            <LinearSlider
              label="brightness"
              value={metadata.brightness}
              min={1}
              max={10}
              step={1}
              showReadout
              format={(v) => `${v}`}
              onChange={(v) => onChange({ brightness: v })}
            />
            <LinearSlider
              label="warmth"
              value={metadata.warmth}
              min={1}
              max={10}
              step={1}
              showReadout
              format={(v) => `${v}`}
              onChange={(v) => onChange({ warmth: v })}
            />
            <LinearSlider
              label="attack"
              value={metadata.attack}
              min={1}
              max={10}
              step={1}
              showReadout
              format={(v) => `${v}`}
              onChange={(v) => onChange({ attack: v })}
            />
            <LinearSlider
              label="sustain"
              value={metadata.sustain}
              min={1}
              max={10}
              step={1}
              showReadout
              format={(v) => `${v}`}
              onChange={(v) => onChange({ sustain: v })}
            />
            <LinearSlider
              label="texture"
              value={metadata.texture}
              min={1}
              max={10}
              step={1}
              showReadout
              format={(v) => `${v}`}
              onChange={(v) => onChange({ texture: v })}
            />
          </div>

          {/* Vibes tags */}
          <div className="flex flex-col gap-1.5">
            <label className="workbench-label" htmlFor="sample-vibes">
              vibes
            </label>
            <div className="flex flex-wrap items-center gap-1.5 border border-[color:var(--wb-line)] bg-[color:var(--ink-900)] px-2 py-1.5 min-h-[34px] focus-within:border-[color:var(--wb-amber-dim)]">
              {metadata.vibes.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 workbench-readout text-[10px] text-[color:var(--wb-amber)] border border-[color:var(--wb-amber-dim)] px-1.5 py-0.5 lowercase"
                >
                  {v}
                  <button
                    type="button"
                    onClick={() => removeVibe(v)}
                    className="text-[color:var(--wb-amber-dim)] hover:text-[color:var(--wb-oxide)] transition-colors"
                    aria-label={`remove ${v}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="sample-vibes"
                type="text"
                value={vibeInput}
                onChange={(e) => setVibeInput(e.target.value)}
                onKeyDown={handleVibeKey}
                placeholder={metadata.vibes.length === 0 ? "type a vibe, press enter" : ""}
                className="flex-1 min-w-[120px] workbench-readout text-xs bg-transparent text-[color:var(--ink-200)] placeholder:text-[color:var(--ink-600)] focus:outline-none lowercase"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
