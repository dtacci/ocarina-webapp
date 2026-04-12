"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Trash2,
  Keyboard,
  Radio,
  WifiOff,
  Target,
  Drum,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DrumEngine } from "@/lib/audio/drum-engine";
import {
  SYNTH_808_MANIFEST,
  type KitManifest,
} from "@/lib/audio/drum-kit-manifest";
import { useDrumPattern, PATTERN_COUNT } from "@/hooks/use-drum-pattern";
import { useLoopState } from "@/hooks/use-loop-state";
import { useHardwareInput, type HardwareEvent } from "@/hooks/use-hardware-input";
import { useDrumKeyboard } from "@/hooks/use-drum-keyboard";
import { DrumStepGrid } from "./drum-step-grid";
import { DrumKitPicker } from "./drum-kit-picker";

type HardwareMode = "edit" | "mute" | "pattern";

interface DrumMachineProps {
  deviceId: string | null;
  deviceName?: string;
  compact?: boolean;
}

export function DrumMachine({ deviceId, compact }: DrumMachineProps) {
  const engineRef = useRef<DrumEngine | null>(null);
  if (engineRef.current == null) {
    engineRef.current = new DrumEngine();
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const tapTimesRef = useRef<number[]>([]);
  const button1HeldRef = useRef(false);

  const [kit, setKit] = useState<KitManifest>(SYNTH_808_MANIFEST);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [localBpm, setLocalBpm] = useState(120);
  const [isFocused, setIsFocused] = useState(false);
  const [hwMode, setHwMode] = useState<HardwareMode>("edit");
  const [helpOpen, setHelpOpen] = useState(false);
  const [anchored, setAnchored] = useState(false);

  const pattern = useDrumPattern(deviceId ?? "local");
  const { loopState, status: loopStatus } = useLoopState(deviceId);

  const looperBpm = loopState.bpm;
  const effectiveBpm = looperBpm ?? localBpm;

  // ---- Engine lifecycle ----------------------------------------------------
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync pattern to engine whenever it changes.
  useEffect(() => {
    engineRef.current?.setPattern(pattern.activePattern);
  }, [pattern.activePattern]);

  // Sync mutes.
  useEffect(() => {
    engineRef.current?.setMutes(pattern.effectiveMutes);
  }, [pattern.effectiveMutes]);

  // Sync BPM.
  useEffect(() => {
    engineRef.current?.setBpm(effectiveBpm);
  }, [effectiveBpm]);

  // Load kit whenever kit changes. Kit loads are fast (synth = instant;
  // samples = small WAV fetches), so we don't track a loading state.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    engine.loadKit(kit).catch((err) => {
      if (!cancelled) console.error("[DrumMachine] loadKit failed", err);
    });
    return () => {
      cancelled = true;
    };
  }, [kit]);

  // Subscribe to step updates from engine. Use rAF-smoothed update so playhead
  // paints without jitter between scheduler ticks.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const off = engine.onStep((step) => {
      setCurrentStep(step);
    });
    return off;
  }, []);

  // Looper phase anchor: when we have a Pi-sourced BPM AND the user has
  // pressed "Align", anchor the drum grid so beat 0 lands on the current
  // AudioContext time. Tempo alone locks automatically via setBpm above.
  const handleAlign = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const ctx = await engine.ensureContext();
    engine.anchorToLooper(effectiveBpm, ctx.currentTime);
    setAnchored(true);
  }, [effectiveBpm]);

  // ---- Transport -----------------------------------------------------------
  const handleTogglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isRunning()) {
      engine.stop();
      setIsPlaying(false);
      setCurrentStep(null);
      return;
    }
    await engine.ensureContext();
    engine.setPattern(pattern.activePattern);
    engine.setMutes(pattern.effectiveMutes);
    engine.setBpm(effectiveBpm);
    engine.start();
    setIsPlaying(true);
  }, [pattern.activePattern, pattern.effectiveMutes, effectiveBpm]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const times = tapTimesRef.current;
    times.push(now);
    // Keep only last 4 taps within 2s window.
    while (times.length > 4 || (times.length > 1 && now - times[0] > 2000)) {
      times.shift();
    }
    if (times.length < 2) return;
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avg);
    if (bpm >= 40 && bpm <= 240) {
      setLocalBpm(bpm);
    }
  }, []);

  const toggleStepAtCursor = useCallback(
    (voiceIdx: number) => {
      pattern.toggleStep(voiceIdx, pattern.state.stepCursor);
      pattern.setCursor(undefined, voiceIdx);
    },
    [pattern]
  );

  const cyclePattern = useCallback(
    (direction: 1 | -1) => {
      const next = (pattern.state.active + direction + PATTERN_COUNT) % PATTERN_COUNT;
      pattern.switchPattern(next);
    },
    [pattern]
  );

  const cycleVelocityAtCursor = useCallback(() => {
    pattern.cycleVelocity(pattern.state.voiceCursor, pattern.state.stepCursor);
  }, [pattern]);

  // ---- Hardware (Teensy via Pi) -------------------------------------------
  const handleHardwareEvent = useCallback(
    (ev: HardwareEvent) => {
      if (ev.button === 1) {
        if (ev.event === "press") {
          button1HeldRef.current = true;
          setHwMode((m) => (m === "edit" ? "mute" : m === "mute" ? "pattern" : "edit"));
        } else if (ev.event === "release") {
          button1HeldRef.current = false;
        }
        return;
      }
      if (ev.button !== undefined && ev.event === "press") {
        const idx = ev.button - 2; // buttons 2-5 → index 0-3
        if (idx < 0 || idx > 3) return;
        if (hwMode === "pattern") {
          pattern.switchPattern(idx);
        } else if (hwMode === "mute") {
          pattern.toggleMute(idx);
        } else if (hwMode === "edit") {
          // Toggle step at cursor for voice idx.
          pattern.toggleStep(idx, pattern.state.stepCursor);
        }
        return;
      }
      if (ev.rotary !== undefined) {
        if (button1HeldRef.current) {
          // Tempo nudge when Button 1 is held.
          setLocalBpm((b) => Math.max(40, Math.min(240, b + ev.rotary!)));
        } else if (hwMode === "edit") {
          pattern.moveCursor(ev.rotary, 0);
        }
      }
    },
    [hwMode, pattern]
  );

  useHardwareInput(deviceId, handleHardwareEvent);

  // ---- Keyboard ------------------------------------------------------------
  useDrumKeyboard(isFocused, {
    togglePlay: handleTogglePlay,
    toggleStepAtCursor,
    moveCursor: pattern.moveCursor,
    switchPattern: pattern.switchPattern,
    cyclePattern,
    clearPattern: () => pattern.clearPattern(),
    tapTempo: handleTapTempo,
    cycleVelocityAtCursor,
    toggleHelp: () => setHelpOpen((v) => !v),
  });

  const voiceNames = kit.voices.map((v) => v.name);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e) => {
        if (e.code === "Escape") {
          (e.currentTarget as HTMLDivElement).blur();
        }
      }}
      className={cn(
        "outline-none rounded-xl border bg-card/50 p-4 backdrop-blur flex flex-col gap-4 transition-all",
        isFocused && "ring-2 ring-amber-400/60"
      )}
      aria-label="Drum machine"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Drum className="size-5" />
          <h2 className={cn("font-bold tracking-tight", compact ? "text-base" : "text-xl")}>
            Drums
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            Beta
          </Badge>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <DrumKitPicker currentKitId={kit.id} onSelect={setKit} />

          {/* Device / tempo status */}
          {deviceId ? (
            <Badge variant="outline" className="gap-1.5 text-[10px]">
              {loopStatus === "connected" ? (
                <Radio className="size-3 text-emerald-400" />
              ) : (
                <WifiOff className="size-3 text-muted-foreground" />
              )}
              <span className="font-mono">
                {effectiveBpm} BPM
                {looperBpm !== null && (
                  <span className="ml-1 text-emerald-400">●</span>
                )}
              </span>
            </Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-mono h-8"
                onClick={() =>
                  setLocalBpm((b) => Math.max(40, Math.min(240, b - 1)))
                }
                title="decrease BPM"
              >
                −
              </Button>
              <span className="text-sm font-mono tabular-nums min-w-[3ch] text-center">
                {effectiveBpm}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-mono h-8"
                onClick={() =>
                  setLocalBpm((b) => Math.max(40, Math.min(240, b + 1)))
                }
                title="increase BPM"
              >
                +
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={handleTapTempo}
                title="tap tempo"
              >
                tap
              </Button>
            </div>
          )}

          {looperBpm !== null && (
            <Button
              variant={anchored ? "secondary" : "outline"}
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={handleAlign}
              title="Anchor drum beat 0 to right now (press on a looper downbeat)"
            >
              <Target className="size-3" />
              {anchored ? "Aligned" : "Align"}
            </Button>
          )}

          <Popover open={helpOpen} onOpenChange={setHelpOpen}>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <Keyboard className="size-3.5" />
                  <span className="text-xs">?</span>
                </Button>
              }
            />
            <PopoverContent align="end" className="w-80 text-xs">
              <KeyboardHelp />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Transport + pattern tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="icon"
          className="size-10 rounded-full shrink-0"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? "stop" : "play"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: PATTERN_COUNT }).map((_, i) => {
            const label = String.fromCharCode(65 + i);
            return (
              <Button
                key={i}
                variant={pattern.state.active === i ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 text-xs font-bold"
                onClick={() => pattern.switchPattern(i)}
              >
                {label}
              </Button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 h-8"
          onClick={() => pattern.clearPattern()}
        >
          <Trash2 className="size-3" />
          Clear
        </Button>

        {deviceId && (
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[10px] uppercase tracking-wider font-mono",
              hwMode === "edit" && "border-emerald-500/50 text-emerald-400",
              hwMode === "mute" && "border-rose-500/50 text-rose-400",
              hwMode === "pattern" && "border-sky-500/50 text-sky-400"
            )}
          >
            hw: {hwMode}
          </Badge>
        )}

        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-wider",
            isFocused ? "border-amber-500/60 text-amber-400" : "text-muted-foreground"
          )}
        >
          {isFocused ? "keys active" : "click to focus"}
        </Badge>
      </div>

      {/* Grid */}
      <DrumStepGrid
        pattern={pattern.activePattern}
        currentStep={isPlaying ? currentStep : null}
        stepCursor={pattern.state.stepCursor}
        voiceCursor={pattern.state.voiceCursor}
        mutes={pattern.state.mutes}
        solo={pattern.state.solo}
        voiceNames={voiceNames}
        onToggleStep={pattern.toggleStep}
        onCycleVelocity={pattern.cycleVelocity}
        onToggleMute={pattern.toggleMute}
        onToggleSolo={pattern.toggleSolo}
        onSetCursor={pattern.setCursor}
      />
    </div>
  );
}

function KeyboardHelp() {
  const rows: Array<[string, string]> = [
    ["Space", "play / pause"],
    ["Q W E R T Y U I", "toggle step at cursor on voice 1–8"],
    ["← / →", "move step cursor"],
    ["↑ / ↓", "move voice cursor"],
    ["Z X C V", "jump to pattern A / B / C / D"],
    ["[ / ]", "prev / next pattern"],
    ["F", "cycle step velocity (low / mid / high)"],
    ["`", "tap tempo"],
    ["Shift + C", "clear current pattern"],
    ["?", "toggle this cheat sheet"],
    ["Esc", "release drum focus"],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-bold text-sm mb-1">Keyboard</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <kbd className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border">
            {k}
          </kbd>
          <span className="text-muted-foreground text-[11px] text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}
