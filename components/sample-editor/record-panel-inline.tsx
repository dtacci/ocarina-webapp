"use client";

import { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Square,
  ChevronDown,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  useMicrophoneRecord,
  type CapturedTake,
} from "@/hooks/use-microphone-record";
import { InputLevelMeter } from "@/components/recordings/input-level-meter";
import { TimecodeDisplay } from "@/components/recordings/timecode-display";

interface Props {
  onTakeCaptured: (take: CapturedTake) => void;
}

export function RecordPanelInline({ onTakeCaptured }: Props) {
  const mic = useMicrophoneRecord();
  // Hand the take up the moment the recorder reaches "captured" — the editor
  // surface above mounts the full pedalboard around the take. Discard /
  // re-record live in the editor's header, not here.
  const handedRef = useRef<CapturedTake | null>(null);
  useEffect(() => {
    if (mic.status === "captured" && mic.take && handedRef.current !== mic.take) {
      handedRef.current = mic.take;
      onTakeCaptured(mic.take);
    }
  }, [mic.status, mic.take, onTakeCaptured]);

  const status = mic.status;
  const isIdle = status === "idle";
  const isRequesting = status === "requesting";
  const isDenied = status === "denied";
  const isReady = status === "ready";
  const isRecording = status === "recording";
  const isStopping = status === "stopping";
  const isError = status === "error";

  return (
    <section
      aria-label="record a new take"
      className="border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)] relative"
    >
      {/* Top bar: status LEDs + timecode */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--wb-line-soft)]">
        <StatusCluster
          input={isReady || isRecording}
          armed={isReady && !isRecording}
          rec={isRecording}
        />
        <TimecodeDisplay
          ms={mic.elapsedMs}
          variant={
            mic.warnAt5min && isRecording
              ? "warn"
              : isRecording
                ? "active"
                : "idle"
          }
        />
      </div>

      {/* Body */}
      <div className="px-6 py-8">
        {(isIdle || isRequesting) && (
          <EmptyState
            isRequesting={isRequesting}
            onAllow={mic.requestPermission}
          />
        )}

        {isDenied && (
          <DeniedState
            message={mic.errorMessage}
            onRetry={mic.requestPermission}
          />
        )}

        {(isReady || isRecording || isStopping) && (
          <ArmedState
            mic={mic}
            isRecording={isRecording}
            isStopping={isStopping}
          />
        )}

        {isError && (
          <div className="flex items-center gap-2 text-xs text-[color:var(--wb-oxide)]">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="lowercase">
              {mic.errorMessage ?? "recording error"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  isRequesting,
  onAllow,
}: {
  isRequesting: boolean;
  onAllow: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--wb-amber-dim)] bg-[color:var(--ink-800)]">
        <Mic className="size-9 text-[color:var(--wb-amber)]" />
      </div>
      <div className="space-y-2 max-w-md">
        <p className="workbench-label text-[color:var(--wb-amber)]">
          ready to record
        </p>
        <p className="text-sm text-[color:var(--ink-300)] lowercase">
          capture a take in the browser. trim, sculpt, and bake it into a
          sample without ever leaving this page.
        </p>
      </div>
      <button
        type="button"
        onClick={onAllow}
        disabled={isRequesting}
        className="inline-flex items-center gap-2 px-5 py-2.5 border border-[color:var(--wb-amber-dim)] text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors workbench-label disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRequesting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Mic className="size-3.5" />
        )}
        {isRequesting ? "requesting…" : "allow microphone"}
      </button>
      <p className="workbench-readout text-[10px] text-[color:var(--ink-600)] lowercase pt-2">
        ↓ or load a draft / sample below
      </p>
    </div>
  );
}

// ─── denied state ────────────────────────────────────────────────────────────

function DeniedState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--wb-oxide)] bg-[color:var(--ink-800)]">
        <MicOff className="size-7 text-[color:var(--wb-oxide)]" />
      </div>
      <div className="space-y-2 max-w-md">
        <p className="workbench-label text-[color:var(--wb-oxide)]">
          input blocked
        </p>
        <p className="text-sm text-[color:var(--ink-300)] lowercase">
          {message ??
            "microphone access is blocked. open site settings to allow it, then try again."}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-[color:var(--wb-line)] hover:border-[color:var(--ink-500)] transition-colors workbench-label"
      >
        <RefreshCw className="size-3.5" /> retry
      </button>
    </div>
  );
}

// ─── armed/recording state ───────────────────────────────────────────────────

function ArmedState({
  mic,
  isRecording,
  isStopping,
}: {
  mic: ReturnType<typeof useMicrophoneRecord>;
  isRecording: boolean;
  isStopping: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* INPUT row — device picker */}
      <div className="flex items-center gap-3">
        <span className="workbench-label w-14 shrink-0">input</span>
        <div className="relative flex-1">
          <select
            value={mic.selectedDeviceId ?? ""}
            onChange={(e) => mic.setSelectedDeviceId(e.target.value)}
            disabled={isRecording || isStopping || mic.devices.length === 0}
            className="w-full appearance-none border border-[color:var(--wb-line-soft)] bg-transparent px-2.5 py-1.5 pr-7 font-mono text-xs text-[color:var(--ink-200)] truncate disabled:opacity-60"
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
            className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[color:var(--ink-500)]"
          />
        </div>
      </div>

      {/* LEVEL row */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="workbench-label w-14 shrink-0">level</span>
          <div className="flex-1">
            <InputLevelMeter
              analyser={mic.analyserNode}
              orientation="horizontal"
              width={320}
              height={8}
            />
          </div>
        </div>
        <div className="pl-[calc(3.5rem+0.75rem)] pr-1">
          <DbScale />
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-[color:var(--wb-line-soft)]">
        <div className="flex flex-col">
          <span className="workbench-label">
            {isRecording ? "recording" : isStopping ? "finalizing" : "standby"}
          </span>
          <span className="font-mono text-[10px] text-[color:var(--ink-500)] mt-1 lowercase">
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
  );
}


// ─── small primitives ───────────────────────────────────────────────────────

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
      className="flex items-center gap-4 text-[0.625rem] font-mono uppercase text-[color:var(--ink-500)]"
      style={{ letterSpacing: "0.22em" }}
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

function LedDot({ on, tone = "amber" }: { on: boolean; tone?: "amber" | "oxide" }) {
  const color =
    tone === "oxide" ? "var(--wb-oxide)" : "var(--wb-amber)";
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full border transition-[background-color,box-shadow] duration-150"
      style={{
        borderColor: on ? color : "var(--wb-amber-dim)",
        backgroundColor: on ? color : "transparent",
        boxShadow: on ? `0 0 6px ${color}, 0 0 1px ${color}` : "none",
      }}
    />
  );
}

function DbScale() {
  return (
    <div
      className="relative h-2 font-mono text-[0.5rem] text-[color:var(--ink-500)]"
      style={{ letterSpacing: "0.15em" }}
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
        backgroundColor: "var(--ink-800)",
        border: `1px solid ${
          isRecording ? "var(--wb-oxide)" : "var(--wb-amber-dim)"
        }`,
        boxShadow: isRecording
          ? "inset 0 0 0 1px var(--wb-oxide), 0 0 18px color-mix(in oklch, var(--wb-oxide) 40%, transparent)"
          : "inset 0 1px 0 rgb(255 255 255 / 4%)",
      }}
    >
      {!isRecording && !isStopping && (
        <span
          aria-hidden
          className="absolute inset-[-3px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            boxShadow:
              "0 0 0 1px var(--wb-amber), 0 0 18px var(--wb-amber-glow)",
          }}
        />
      )}

      <span
        className="relative flex h-11 w-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: isRecording
            ? "color-mix(in oklch, var(--wb-oxide) 18%, var(--ink-900))"
            : "var(--ink-900)",
          border: `1px solid ${
            isRecording ? "var(--wb-oxide)" : "var(--wb-amber-dim)"
          }`,
        }}
      >
        {isStopping ? (
          <Loader2 className="size-4 animate-spin text-[color:var(--wb-amber)]" />
        ) : isRecording ? (
          <Square
            className="size-4"
            style={{
              color: "var(--wb-oxide)",
              fill: "var(--wb-oxide)",
            }}
          />
        ) : (
          <span
            aria-hidden
            className="block h-3 w-3 rounded-full"
            style={{
              backgroundColor: "var(--wb-oxide)",
              boxShadow:
                "0 0 0 1px color-mix(in oklch, var(--wb-oxide) 60%, transparent)",
            }}
          />
        )}

        {isRecording && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              animation: "record-pulse-inline 1.6s ease-in-out infinite",
              boxShadow: "0 0 0 0 var(--wb-oxide)",
            }}
          />
        )}
      </span>

      <span
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[0.55rem] uppercase"
        style={{
          letterSpacing: "0.28em",
          color: isRecording ? "var(--wb-oxide)" : "var(--ink-500)",
        }}
      >
        {isStopping ? "…" : isRecording ? "stop" : "rec"}
      </span>

      <style>{`
        @keyframes record-pulse-inline {
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
