"use client";

/**
 * One mixer channel strip: label, fader, pan, mute/solo, meter, fx toggle.
 * The per-channel effect chain renders below the strip row (mixer-surface
 * owns that layout) — a full pedalboard per strip would dwarf the mixer.
 */
import type * as Tone from "tone";
import type { MixChannelSpec } from "@/lib/audio/mix-types";
import { Knob } from "@/components/sample-editor/primitives/knob";
import { LinearSlider } from "@/components/sample-editor/primitives/linear-slider";
import { PeakMeter } from "@/components/sample-editor/peak-meter";

export interface ChannelStripProps {
  spec: MixChannelSpec;
  analyser: Tone.Analyser | null;
  fxOpen: boolean;
  onChange: (patch: Partial<MixChannelSpec>) => void;
  onToggleFx: () => void;
}

export function ChannelStrip({ spec, analyser, fxOpen, onChange, onToggleFx }: ChannelStripProps) {
  const fxCount = spec.chain.filter((n) => n.enabled).length;
  return (
    <div
      role="group"
      aria-label={`channel ${spec.label}`}
      className="flex items-end gap-4 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-4 py-3"
    >
      <span className="workbench-label w-28 truncate text-[color:var(--ink-300)]" title={spec.label}>
        {spec.label}
      </span>

      <LinearSlider
        value={spec.volume}
        min={0}
        max={1.5}
        step={0.01}
        label="level"
        width={160}
        showReadout
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => onChange({ volume: v })}
      />

      <Knob
        label="pan"
        value={spec.pan}
        min={-1}
        max={1}
        step={0.02}
        defaultValue={0}
        size={40}
        format={(v) =>
          Math.abs(v) < 0.02 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`
        }
        onChange={(v) => onChange({ pan: v })}
      />

      <button
        type="button"
        onClick={() => onChange({ muted: !spec.muted })}
        aria-pressed={spec.muted}
        className="workbench-label border px-2.5 py-1.5 transition-colors"
        style={{
          borderColor: spec.muted ? "var(--wb-oxide)" : "var(--wb-line)",
          color: spec.muted ? "var(--wb-oxide)" : "var(--ink-500)",
        }}
      >
        mute
      </button>
      <button
        type="button"
        onClick={() => onChange({ soloed: !spec.soloed })}
        aria-pressed={spec.soloed}
        className="workbench-label border px-2.5 py-1.5 transition-colors"
        style={{
          borderColor: spec.soloed ? "var(--wb-amber)" : "var(--wb-line)",
          color: spec.soloed ? "var(--wb-amber)" : "var(--ink-500)",
        }}
      >
        solo
      </button>

      <button
        type="button"
        onClick={onToggleFx}
        aria-expanded={fxOpen}
        className="workbench-label flex items-center gap-1.5 border border-[color:var(--wb-line)] px-2.5 py-1.5 transition-colors hover:border-[color:var(--wb-amber-dim)]"
        style={{ color: fxOpen || fxCount > 0 ? "var(--wb-amber)" : "var(--ink-500)" }}
      >
        <span className="workbench-led" data-on={fxCount > 0} />
        fx{fxCount > 0 ? ` ·${fxCount}` : ""}
      </button>

      <div className="ml-auto">
        <PeakMeter analyser={analyser} height={40} />
      </div>
    </div>
  );
}
