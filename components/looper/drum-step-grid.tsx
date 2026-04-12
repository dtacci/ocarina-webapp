"use client";

import { Volume2, VolumeX, Headphones } from "lucide-react";
import type { Pattern, Velocity } from "@/lib/audio/drum-engine";
import { cn } from "@/lib/utils";
import {
  TRACK_COLORS,
  TRACK_STEP_FILL,
  TRACK_STEP_RING,
} from "./track-colors";

export const STEP_COUNT = 16;
export const VOICE_COUNT = 8;

interface DrumStepGridProps {
  pattern: Pattern;
  currentStep: number | null; // null when stopped
  stepCursor: number;
  voiceCursor: number;
  mutes: boolean[];
  solo: number | null;
  voiceNames: string[];
  onToggleStep: (voice: number, step: number) => void;
  onCycleVelocity: (voice: number, step: number) => void;
  onToggleMute: (voice: number) => void;
  onToggleSolo: (voice: number) => void;
  onSetCursor: (step?: number, voice?: number) => void;
}

const VELOCITY_OPACITY: Record<Velocity, string> = {
  0: "opacity-40",
  1: "opacity-70",
  2: "opacity-100",
};

export function DrumStepGrid({
  pattern,
  currentStep,
  stepCursor,
  voiceCursor,
  mutes,
  solo,
  voiceNames,
  onToggleStep,
  onCycleVelocity,
  onToggleMute,
  onToggleSolo,
  onSetCursor,
}: DrumStepGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <StepHeader currentStep={currentStep} stepCursor={stepCursor} />
        <div className="flex flex-col gap-1 mt-1">
          {pattern.map((row, voiceIdx) => {
            const color = TRACK_COLORS[voiceIdx % TRACK_COLORS.length];
            const muted = mutes[voiceIdx] || (solo !== null && solo !== voiceIdx);
            const isSoloed = solo === voiceIdx;
            const isVoiceActive = voiceIdx === voiceCursor;
            return (
              <div
                key={voiceIdx}
                className={cn(
                  "grid grid-cols-[120px_1fr] gap-2 items-center",
                  isVoiceActive && "bg-muted/30 rounded-md"
                )}
              >
                <VoiceLabel
                  name={voiceNames[voiceIdx] ?? `voice-${voiceIdx + 1}`}
                  color={color}
                  muted={muted}
                  soloed={isSoloed}
                  active={isVoiceActive}
                  onClick={() => onSetCursor(undefined, voiceIdx)}
                  onMute={() => onToggleMute(voiceIdx)}
                  onSolo={() => onToggleSolo(voiceIdx)}
                />
                <div className="grid grid-cols-16 gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                  {row.map((step, stepIdx) => {
                    const isPlayhead = currentStep === stepIdx;
                    const isCursor = stepCursor === stepIdx && isVoiceActive;
                    const isBeat = stepIdx % 4 === 0;
                    return (
                      <button
                        key={stepIdx}
                        type="button"
                        onClick={(e) => {
                          onSetCursor(stepIdx, voiceIdx);
                          if (e.shiftKey && step.on) {
                            onCycleVelocity(voiceIdx, stepIdx);
                          } else {
                            onToggleStep(voiceIdx, stepIdx);
                          }
                        }}
                        className={cn(
                          "relative aspect-square min-h-[32px] sm:min-h-[36px] rounded-sm border transition-all",
                          isBeat ? "border-border/80" : "border-border/30",
                          !step.on && "bg-muted/20 hover:bg-muted/40",
                          step.on && cn(TRACK_STEP_FILL[color], VELOCITY_OPACITY[step.velocity]),
                          muted && step.on && "opacity-30",
                          isPlayhead && "ring-2 ring-offset-1 ring-offset-background",
                          isPlayhead && TRACK_STEP_RING[color],
                          isCursor && "outline outline-1 outline-amber-400"
                        )}
                        aria-label={`voice ${voiceIdx + 1} step ${stepIdx + 1} ${step.on ? "on" : "off"}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepHeader({
  currentStep,
  stepCursor,
}: {
  currentStep: number | null;
  stepCursor: number;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div />
      <div className="grid" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => {
          const isBeat = i % 4 === 0;
          return (
            <div
              key={i}
              className={cn(
                "text-[10px] text-center font-mono select-none",
                isBeat ? "text-foreground/70" : "text-muted-foreground/40",
                currentStep === i && "text-amber-400 font-bold",
                stepCursor === i && "underline underline-offset-2"
              )}
            >
              {isBeat ? i / 4 + 1 : "·"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoiceLabel({
  name,
  color,
  muted,
  soloed,
  active,
  onClick,
  onMute,
  onSolo,
}: {
  name: string;
  color: string;
  muted: boolean;
  soloed: boolean;
  active: boolean;
  onClick: () => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 pl-2 pr-1 py-1 rounded-sm cursor-pointer group",
        active && "font-semibold"
      )}
      onClick={onClick}
    >
      <div className={cn("size-2 rounded-full shrink-0", color)} />
      <span
        className={cn(
          "text-xs flex-1 truncate",
          muted && "line-through text-muted-foreground"
        )}
      >
        {name}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSolo();
        }}
        className={cn(
          "size-5 flex items-center justify-center rounded opacity-50 hover:opacity-100 transition-opacity",
          soloed && "opacity-100 text-amber-400"
        )}
        aria-label={`${soloed ? "un-solo" : "solo"} ${name}`}
      >
        <Headphones className="size-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMute();
        }}
        className={cn(
          "size-5 flex items-center justify-center rounded opacity-50 hover:opacity-100 transition-opacity",
          muted && "opacity-100 text-rose-400"
        )}
        aria-label={`${muted ? "unmute" : "mute"} ${name}`}
      >
        {muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
      </button>
    </div>
  );
}
