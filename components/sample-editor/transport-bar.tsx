"use client";

/**
 * Transport strip — sits between waveform and signal chain.
 *
 * Layout (left → right):
 *   [▶ PLAY / ■ STOP] [↻ LOOP]   |   [A|B] 0:00.000   |   [peak meter]
 *
 * The timecode span is populated via `timecodeRef` — the editor's rAF loop
 * mutates `textContent` directly so playback-time display doesn't trigger
 * React re-renders at 60fps.
 */

import { forwardRef, type Ref } from "react";
import type * as Tone from "tone";
import { AbSwitch } from "./ab-switch";
import { PeakMeter } from "./peak-meter";

interface Props {
  isPlaying: boolean;
  isStarting: boolean;
  disabled: boolean;
  loop: boolean;
  bypass: boolean;
  analyser: Tone.Analyser | null;
  onPlayToggle: () => void;
  onLoopToggle: () => void;
  onBypassToggle: () => void;
}

export const TransportBar = forwardRef<HTMLSpanElement, Props>(
  function TransportBar(
    {
      isPlaying,
      isStarting,
      disabled,
      loop,
      bypass,
      analyser,
      onPlayToggle,
      onLoopToggle,
      onBypassToggle,
    },
    timecodeRef: Ref<HTMLSpanElement>,
  ) {
    return (
      <section
        className="flex items-center gap-4 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-4"
        style={{ height: 52 }}
        aria-label="transport"
      >
        {/* Left zone: play + loop */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPlayToggle}
            disabled={disabled || isStarting}
            aria-label={isPlaying ? "stop playback" : "start playback"}
            className="workbench-label px-3 py-1.5 border border-[color:var(--wb-amber-dim)] text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[82px] text-left tabular-nums"
          >
            {isStarting ? "… loading" : isPlaying ? "■ stop" : "▶ play"}
          </button>

          <button
            type="button"
            onClick={onLoopToggle}
            aria-pressed={loop}
            aria-label={loop ? "disable loop" : "enable loop"}
            className="workbench-label flex items-center gap-2 px-3 py-1.5 border border-[color:var(--wb-line)] hover:border-[color:var(--ink-500)] transition-colors"
            style={{ color: loop ? "var(--wb-amber)" : "var(--ink-500)" }}
          >
            <span className="workbench-led" data-on={loop} />
            loop
          </button>
        </div>

        <div className="h-5 w-px bg-[color:var(--wb-line)]" />

        {/* Center zone: A|B + timecode */}
        <div className="flex items-center gap-4">
          <AbSwitch bypass={bypass} onToggle={onBypassToggle} />
          <span
            ref={timecodeRef}
            className="workbench-readout text-sm tabular-nums"
            style={{ color: "var(--ink-300)", minWidth: 74 }}
          >
            0:00.000
          </span>
        </div>

        {/* Right zone: peak meter */}
        <div className="ml-auto flex items-center gap-2">
          <span className="workbench-label">peak</span>
          <PeakMeter analyser={analyser} />
        </div>
      </section>
    );
  },
);
