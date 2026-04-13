"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Square,
  Trash2,
  RefreshCw,
  Save,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronDown,
  Play,
  Pause,
} from "lucide-react";
import { useMicrophoneRecord } from "@/hooks/use-microphone-record";
import { InputLevelMeter } from "./input-level-meter";
import { TimecodeDisplay } from "./timecode-display";
import { uploadAndConfirmRecording } from "@/lib/recordings/upload-and-confirm";

interface Props {
  onSaved: (recording: { id: string; title: string }) => void;
  onOpenInEditor: (recordingId: string) => void;
  onBusyChange?: (busy: boolean) => void;
  registerReset?: (reset: () => void) => void;
}

function defaultTitle(): string {
  const now = new Date();
  return `Recording — ${now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function filenameFromDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `recording-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}.wav`;
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof pos, string> = {
    tl: "top-0 left-0 border-t border-l",
    tr: "top-0 right-0 border-t border-r",
    bl: "bottom-0 left-0 border-b border-l",
    br: "bottom-0 right-0 border-b border-r",
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-2.5 w-2.5 ${map[pos]}`}
      style={{ borderColor: "var(--wb-amber-dim, oklch(0.50 0.12 65))" }}
    />
  );
}

function LedDot({ on, tone = "amber" }: { on: boolean; tone?: "amber" | "oxide" }) {
  const color =
    tone === "oxide"
      ? "var(--wb-oxide, oklch(0.55 0.19 28))"
      : "var(--wb-amber, oklch(0.78 0.18 68))";
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full border transition-[background-color,box-shadow] duration-150"
      style={{
        borderColor: on ? color : "var(--wb-amber-dim, oklch(0.40 0.08 65))",
        backgroundColor: on ? color : "transparent",
        boxShadow: on ? `0 0 6px ${color}, 0 0 1px ${color}` : "none",
      }}
    />
  );
}

function StatusCluster({
  input,
  armed,
  rec,
}: {
  input: boolean;
  armed: boolean;
  rec: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4 text-[0.625rem] font-mono uppercase"
      style={{ letterSpacing: "0.22em", color: "var(--muted-foreground)" }}
    >
      <span className="flex items-center gap-1.5">
        <LedDot on={input} /> input
      </span>
      <span className="flex items-center gap-1.5">
        <LedDot on={armed} /> armed
      </span>
      <span className="flex items-center gap-1.5">
        <LedDot on={rec} tone="oxide" /> rec
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono uppercase text-[0.625rem] shrink-0"
      style={{
        letterSpacing: "0.22em",
        color: "var(--muted-foreground)",
      }}
    >
      {children}
    </span>
  );
}

function DbScale() {
  return (
    <div
      className="relative h-2 font-mono text-[0.5rem]"
      style={{
        letterSpacing: "0.15em",
        color: "var(--muted-foreground)",
      }}
      aria-hidden
    >
      {[
        { pct: 0, label: "-60" },
        { pct: 50, label: "-30" },
        { pct: 80, label: "-12" },
        { pct: 95, label: "-3" },
        { pct: 100, label: "0" },
      ].map((t) => (
        <span
          key={t.label}
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${t.pct}%` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function WaveformPreview({ peaks }: { peaks: number[] }) {
  const path = useMemo(() => {
    const w = 400;
    const h = 80;
    const mid = h / 2;
    if (peaks.length === 0) return `M0 ${mid} L${w} ${mid}`;
    let top = `M0 ${mid}`;
    let bot = `M0 ${mid}`;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / (peaks.length - 1)) * w;
      const amp = Math.max(0.02, peaks[i]) * (mid - 2);
      top += ` L${x} ${mid - amp}`;
      bot += ` L${x} ${mid + amp}`;
    }
    return `${top} L${w} ${mid} ${bot.replace("M", "L")} Z`;
  }, [peaks]);

  return (
    <svg
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      className="w-full h-16 block"
      aria-label="waveform preview"
    >
      <line
        x1={0}
        x2={400}
        y1={40}
        y2={40}
        stroke="var(--wb-line-soft, oklch(1 0 0 / 8%))"
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
      <path d={path} fill="var(--wb-amber, oklch(0.78 0.18 68))" opacity={0.85} />
    </svg>
  );
}

type Stage = "panel" | "saving" | "error-save";

export function RecordPanel({
  onSaved,
  onOpenInEditor,
  onBusyChange,
  registerReset,
}: Props) {
  const mic = useMicrophoneRecord();
  const [title, setTitle] = useState(defaultTitle);
  const [stage, setStage] = useState<Stage>("panel");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const previewUrl = useMemo(
    () => (mic.take ? URL.createObjectURL(mic.take.wavBlob) : null),
    [mic.take],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (registerReset) registerReset(mic.reset);
  }, [registerReset, mic.reset]);

  useEffect(() => {
    onBusyChange?.(stage === "saving");
  }, [stage, onBusyChange]);

  async function performSave(): Promise<{ id: string; title: string } | null> {
    const take = mic.take;
    if (!take) return null;
    setStage("saving");
    setSaveError(null);
    try {
      const result = await uploadAndConfirmRecording({
        blob: take.wavBlob,
        contentType: "audio/wav",
        fileName: filenameFromDate(),
        title: title.trim() || defaultTitle(),
        peaks: take.peaks,
        durationSec: take.durationSec,
      });
      return result;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setStage("error-save");
      return null;
    }
  }

  async function handleSave() {
    const r = await performSave();
    if (r) onSaved(r);
  }

  async function handleSaveAndEdit() {
    const r = await performSave();
    if (r) onOpenInEditor(r.id);
  }

  function togglePreview() {
    const el = audioRef.current;
    if (!el) return;
    if (isPreviewPlaying) {
      el.pause();
    } else {
      void el.play();
    }
  }

  const status = mic.status;
  const isIdle = status === "idle";
  const isRequesting = status === "requesting";
  const isDenied = status === "denied";
  const isReady = status === "ready";
  const isRecording = status === "recording";
  const isStopping = status === "stopping";
  const isCaptured = status === "captured";
  const isError = status === "error";

  return (
    <div className="flex flex-col gap-4">
      {/* Instrument viewport frame */}
      <div
        className="relative rounded-md"
        style={{
          backgroundColor: "var(--ink-900, oklch(0.12 0.010 70))",
          border: "1px solid var(--wb-line-soft, oklch(1 0 0 / 8%))",
        }}
      >
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />

        {/* Top bar: status LEDs + timecode */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "var(--wb-line-soft, oklch(1 0 0 / 8%))" }}
        >
          <StatusCluster
            input={isReady || isRecording || isCaptured}
            armed={isReady && !isRecording}
            rec={isRecording}
          />
          <TimecodeDisplay
            ms={
              isCaptured && mic.take
                ? mic.take.durationSec * 1000
                : mic.elapsedMs
            }
            variant={
              mic.warnAt5min && isRecording
                ? "warn"
                : isRecording || isCaptured
                ? "active"
                : "idle"
            }
          />
        </div>

        {/* Body */}
        <div className="px-4 py-5">
          {(isIdle || isRequesting) && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "var(--ink-800, oklch(0.16 0.010 70))",
                  border: "1px solid var(--wb-amber-dim, oklch(0.40 0.08 65))",
                }}
              >
                <Mic
                  className="size-7"
                  style={{ color: "var(--wb-amber, oklch(0.78 0.18 68))" }}
                />
              </div>
              <div className="space-y-1.5">
                <p
                  className="font-mono uppercase text-[0.625rem]"
                  style={{
                    letterSpacing: "0.22em",
                    color: "var(--muted-foreground)",
                  }}
                >
                  input offline
                </p>
                <p className="text-sm text-muted-foreground max-w-[22rem]">
                  Capture vocal direction, an instrument takes, or a demo idea
                  straight from your microphone.
                </p>
              </div>
              <button
                type="button"
                onClick={mic.requestPermission}
                disabled={isRequesting}
                className="inline-flex items-center gap-2 rounded-sm border px-4 py-2 font-mono uppercase text-[0.7rem] transition-[background-color,box-shadow] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  letterSpacing: "0.22em",
                  color: "var(--wb-amber, oklch(0.78 0.18 68))",
                  borderColor: "var(--wb-amber-dim, oklch(0.40 0.08 65))",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 0 1px var(--wb-amber, oklch(0.78 0.18 68)), 0 0 14px var(--wb-amber-glow, oklch(0.78 0.18 68 / 0.30))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {isRequesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mic className="size-3.5" />
                )}
                {isRequesting ? "requesting…" : "allow microphone"}
              </button>
            </div>
          )}

          {isDenied && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "var(--ink-800, oklch(0.16 0.010 70))",
                  border: "1px solid var(--wb-oxide, oklch(0.55 0.19 28))",
                }}
              >
                <MicOff
                  className="size-7"
                  style={{ color: "var(--wb-oxide, oklch(0.55 0.19 28))" }}
                />
              </div>
              <div className="space-y-1.5">
                <p
                  className="font-mono uppercase text-[0.625rem]"
                  style={{
                    letterSpacing: "0.22em",
                    color: "var(--wb-oxide, oklch(0.55 0.19 28))",
                  }}
                >
                  input blocked
                </p>
                <p className="text-sm text-muted-foreground max-w-[22rem]">
                  {mic.errorMessage ??
                    "Microphone access is blocked. Open site settings to allow it, then try again."}
                </p>
              </div>
              <button
                type="button"
                onClick={mic.requestPermission}
                className="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono uppercase text-[0.7rem] hover:bg-muted/30"
                style={{ letterSpacing: "0.22em" }}
              >
                <RefreshCw className="size-3.5" /> retry
              </button>
            </div>
          )}

          {(isReady || isRecording || isStopping) && (
            <div className="space-y-4">
              {/* INPUT row — device picker */}
              <div className="flex items-center gap-3">
                <Label>input</Label>
                <div className="relative flex-1">
                  <select
                    value={mic.selectedDeviceId ?? ""}
                    onChange={(e) => mic.setSelectedDeviceId(e.target.value)}
                    disabled={isRecording || isStopping || mic.devices.length === 0}
                    className="w-full appearance-none rounded-sm border bg-transparent px-2.5 py-1.5 pr-7 font-mono text-xs truncate disabled:opacity-60"
                    style={{
                      borderColor: "var(--wb-line-soft, oklch(1 0 0 / 8%))",
                      color: "var(--foreground)",
                    }}
                  >
                    {mic.devices.length === 0 && <option>default</option>}
                    {mic.devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `mic ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>

              {/* LEVEL row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <Label>level</Label>
                  <div className="flex-1">
                    <InputLevelMeter
                      analyser={mic.analyserNode}
                      orientation="horizontal"
                      width={320}
                      height={8}
                    />
                  </div>
                </div>
                <div className="pl-[calc(2.5rem+0.75rem)] pr-1">
                  <DbScale />
                </div>
              </div>

              {/* Transport */}
              <div
                className="flex items-center justify-between gap-4 pt-2 border-t"
                style={{ borderColor: "var(--wb-line-soft, oklch(1 0 0 / 8%))" }}
              >
                <div className="flex flex-col">
                  <Label>
                    {isRecording ? "recording" : isStopping ? "finalizing" : "standby"}
                  </Label>
                  <span className="font-mono text-[0.65rem] text-muted-foreground mt-1">
                    {mic.warnAt5min && isRecording
                      ? "auto-stop at 10:00"
                      : "max 10:00"}
                  </span>
                </div>

                <RecordButton
                  state={isRecording ? "recording" : isStopping ? "stopping" : "armed"}
                  onArmedClick={mic.start}
                  onRecordingClick={mic.stop}
                />
              </div>
            </div>
          )}

          {isCaptured && mic.take && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span
                  className="font-mono uppercase text-[0.625rem]"
                  style={{
                    letterSpacing: "0.22em",
                    color: "var(--wb-amber, oklch(0.78 0.18 68))",
                  }}
                >
                  take captured
                </span>
                <button
                  type="button"
                  onClick={togglePreview}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-border/60 px-2 py-1 font-mono text-[0.65rem] hover:bg-muted/30"
                  aria-label={isPreviewPlaying ? "pause preview" : "play preview"}
                >
                  {isPreviewPlaying ? (
                    <Pause className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                  {isPreviewPlaying ? "pause" : "preview"}
                </button>
              </div>

              {/* Waveform viewport */}
              <div
                className="rounded-sm p-2"
                style={{
                  backgroundColor: "var(--ink-800, oklch(0.16 0.010 70))",
                  border: "1px solid var(--wb-line-soft, oklch(1 0 0 / 8%))",
                }}
              >
                <WaveformPreview peaks={mic.take.peaks} />
              </div>

              {/* Title input */}
              <div className="flex items-center gap-3">
                <Label>title</Label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={stage === "saving"}
                  placeholder={defaultTitle()}
                  className="flex-1 rounded-sm border bg-transparent px-2.5 py-1.5 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:opacity-60"
                  style={{ borderColor: "var(--wb-line-soft, oklch(1 0 0 / 8%))" }}
                  maxLength={120}
                />
              </div>

              {previewUrl && (
                <audio
                  ref={audioRef}
                  src={previewUrl}
                  preload="metadata"
                  onPlay={() => setIsPreviewPlaying(true)}
                  onPause={() => setIsPreviewPlaying(false)}
                  onEnded={() => setIsPreviewPlaying(false)}
                  className="hidden"
                />
              )}

              {saveError && (
                <div
                  className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs"
                  style={{
                    backgroundColor: "color-mix(in oklch, var(--wb-oxide) 12%, transparent)",
                    color: "var(--wb-oxide, oklch(0.55 0.19 28))",
                  }}
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  {saveError}
                </div>
              )}
            </div>
          )}

          {isError && !isCaptured && (
            <div className="flex items-center gap-2 rounded-sm px-3 py-2 text-xs text-destructive bg-destructive/10">
              <AlertCircle className="size-3.5 shrink-0" />
              {mic.errorMessage ?? "Recording error"}
            </div>
          )}
        </div>
      </div>

      {/* Action row (only in captured state) */}
      {isCaptured && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                mic.discard();
                setTitle(defaultTitle());
              }}
              disabled={stage === "saving"}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border/60 px-3 py-1.5 text-xs font-mono uppercase hover:bg-muted/40 disabled:opacity-60"
              style={{ letterSpacing: "0.18em" }}
            >
              <Trash2 className="size-3.5" /> discard
            </button>
            <button
              type="button"
              onClick={() => {
                mic.discard();
                setTitle(defaultTitle());
                setTimeout(() => void mic.start(), 30);
              }}
              disabled={stage === "saving"}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border/60 px-3 py-1.5 text-xs font-mono uppercase hover:bg-muted/40 disabled:opacity-60"
              style={{ letterSpacing: "0.18em" }}
            >
              <RefreshCw className="size-3.5" /> re-record
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSave}
              disabled={stage === "saving"}
              className="inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-mono uppercase disabled:opacity-60"
              style={{
                letterSpacing: "0.18em",
                color: "var(--wb-amber, oklch(0.78 0.18 68))",
                borderColor: "var(--wb-amber-dim, oklch(0.40 0.08 65))",
              }}
            >
              {stage === "saving" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {stage === "saving" ? "saving…" : "save"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveAndEdit}
            disabled={stage === "saving"}
            className="self-end inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase text-muted-foreground hover:text-foreground disabled:opacity-60"
            style={{ letterSpacing: "0.18em" }}
          >
            save & open in editor <ExternalLink className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record button — hardware-style beveled key, amber aura when armed,
// oxide-pulsing face when recording. No generic red circle.

function RecordButton({
  state,
  onArmedClick,
  onRecordingClick,
}: {
  state: "armed" | "recording" | "stopping";
  onArmedClick: () => void;
  onRecordingClick: () => void;
}) {
  const isRecording = state === "recording";
  const isStopping = state === "stopping";

  return (
    <button
      type="button"
      onClick={isRecording ? onRecordingClick : onArmedClick}
      disabled={isStopping}
      className="group relative flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
      aria-label={isRecording ? "stop recording" : "start recording"}
      style={{
        backgroundColor: "var(--ink-800, oklch(0.16 0.010 70))",
        border: `1px solid ${
          isRecording
            ? "var(--wb-oxide, oklch(0.55 0.19 28))"
            : "var(--wb-amber-dim, oklch(0.40 0.08 65))"
        }`,
        boxShadow: isRecording
          ? "inset 0 0 0 1px var(--wb-oxide, oklch(0.55 0.19 28)), 0 0 18px color-mix(in oklch, var(--wb-oxide) 40%, transparent)"
          : "inset 0 1px 0 rgb(255 255 255 / 4%), 0 0 0 1px transparent",
      }}
    >
      {/* Aura ring (armed only) */}
      {!isRecording && !isStopping && (
        <span
          aria-hidden
          className="absolute inset-[-3px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            boxShadow:
              "0 0 0 1px var(--wb-amber, oklch(0.78 0.18 68)), 0 0 18px var(--wb-amber-glow, oklch(0.78 0.18 68 / 0.30))",
          }}
        />
      )}

      {/* Face */}
      <span
        className="relative flex h-11 w-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: isRecording
            ? "color-mix(in oklch, var(--wb-oxide) 18%, var(--ink-900))"
            : "var(--ink-900, oklch(0.12 0.010 70))",
          border: `1px solid ${
            isRecording
              ? "var(--wb-oxide, oklch(0.55 0.19 28))"
              : "var(--wb-amber-dim, oklch(0.40 0.08 65))"
          }`,
        }}
      >
        {isStopping ? (
          <Loader2
            className="size-4 animate-spin"
            style={{ color: "var(--wb-amber, oklch(0.78 0.18 68))" }}
          />
        ) : isRecording ? (
          <Square
            className="size-4"
            style={{
              color: "var(--wb-oxide, oklch(0.55 0.19 28))",
              fill: "var(--wb-oxide, oklch(0.55 0.19 28))",
            }}
          />
        ) : (
          <span
            aria-hidden
            className="block h-3 w-3 rounded-full"
            style={{
              backgroundColor: "var(--wb-oxide, oklch(0.55 0.19 28))",
              boxShadow:
                "0 0 0 1px color-mix(in oklch, var(--wb-oxide) 60%, transparent)",
            }}
          />
        )}

        {/* Recording pulse ring */}
        {isRecording && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              animation: "record-pulse 1.6s ease-in-out infinite",
              boxShadow: "0 0 0 0 var(--wb-oxide, oklch(0.55 0.19 28))",
            }}
          />
        )}
      </span>

      {/* Label */}
      <span
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[0.55rem] uppercase"
        style={{
          letterSpacing: "0.28em",
          color: isRecording
            ? "var(--wb-oxide, oklch(0.55 0.19 28))"
            : "var(--muted-foreground)",
        }}
      >
        {isStopping ? "…" : isRecording ? "stop" : "rec"}
      </span>

      <style>{`
        @keyframes record-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 color-mix(in oklch, var(--wb-oxide) 55%, transparent);
          }
          50% {
            box-shadow: 0 0 0 10px color-mix(in oklch, var(--wb-oxide) 0%, transparent);
          }
        }
      `}</style>
    </button>
  );
}
