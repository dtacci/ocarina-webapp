"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "harmony" }>;
  onChange: (node: Extract<EffectNode, { kind: "harmony" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.harmony;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "+7 st · G" style — references absolute interval against C. 0 = "off". */
function formatVoice(st: number): string {
  if (st === 0) return "off";
  const sign = st > 0 ? "+" : "";
  const note = NOTE_NAMES[(((Math.round(st) % 12) + 12) % 12)];
  return `${sign}${st.toFixed(0)} st · ${note}`;
}

interface Preset {
  label: string;
  v1: number;
  v2: number;
  wet: number;
}

/**
 * Curated harmony presets. All keep the dry signal audible (wet ≤ 0.55) so
 * the harmonies thicken rather than replace the source. A "voice = 0" means
 * that voice is muted.
 */
const PRESETS: Preset[] = [
  { label: "octave up", v1: 12, v2: 0, wet: 0.45 },
  { label: "octave down", v1: -12, v2: 0, wet: 0.45 },
  { label: "fifth", v1: 7, v2: 0, wet: 0.4 },
  { label: "octave + fifth", v1: 7, v2: 12, wet: 0.5 },
  { label: "major third", v1: 4, v2: 7, wet: 0.45 },
  { label: "minor third", v1: 3, v2: 7, wet: 0.45 },
  { label: "wide stack", v1: -12, v2: 12, wet: 0.55 },
];

export function HarmonyCard({ node, onChange, onRemove, reorder }: Props) {
  const activePreset = PRESETS.find(
    (p) =>
      p.v1 === node.voice1Semitones &&
      p.v2 === node.voice2Semitones &&
      Math.abs(p.wet - node.wet) < 0.01,
  );

  const applyPreset = (p: Preset) => {
    onChange({
      ...node,
      enabled: true,
      voice1Semitones: p.v1,
      voice2Semitones: p.v2,
      wet: p.wet,
    });
  };

  return (
    <EffectCard
      label="HARMONY"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
      minWidth={300}
    >
      <div className="space-y-3">
        {/* Preset row */}
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => {
            const isActive = activePreset?.label === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={isActive}
                className="workbench-readout text-[10px] px-2 py-1 border lowercase transition-colors"
                style={{
                  borderColor: isActive
                    ? "var(--wb-amber)"
                    : "var(--wb-line-soft)",
                  color: isActive
                    ? "var(--wb-amber)"
                    : "var(--ink-300)",
                  backgroundColor: isActive
                    ? "var(--wb-amber-glow)"
                    : "transparent",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Knobs */}
        <div className="flex items-start gap-4 pt-2 border-t border-[color:var(--wb-line-soft)]">
          <Knob
            label="VOICE 1"
            value={node.voice1Semitones}
            min={R.voice1Semitones.min}
            max={R.voice1Semitones.max}
            defaultValue={R.voice1Semitones.default}
            step={1}
            format={formatVoice}
            onChange={(v) => onChange({ ...node, voice1Semitones: v })}
          />
          <Knob
            label="VOICE 2"
            value={node.voice2Semitones}
            min={R.voice2Semitones.min}
            max={R.voice2Semitones.max}
            defaultValue={R.voice2Semitones.default}
            step={1}
            format={formatVoice}
            onChange={(v) => onChange({ ...node, voice2Semitones: v })}
          />
          <Knob
            label="MIX"
            value={node.wet}
            min={R.wet.min}
            max={R.wet.max}
            defaultValue={R.wet.default}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)} %`}
            onChange={(v) => onChange({ ...node, wet: v })}
          />
        </div>
      </div>
    </EffectCard>
  );
}
