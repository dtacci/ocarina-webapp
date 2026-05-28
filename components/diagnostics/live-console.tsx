"use client";

import { Loader2, AlertTriangle, Usb } from "lucide-react";

import {
  useLiveConsoleSignals,
  type ConsoleStatus,
  type TeensyState,
} from "@/hooks/use-live-console-signals";

import { DeviceStatusBar } from "@/components/diagnostics/device-status-bar";
import { VirtualKeyboard } from "@/components/diagnostics/virtual-keyboard";
import { NoteReadout } from "@/components/diagnostics/note-readout";
import { FxStatePanel } from "@/components/diagnostics/fx-state-panel";
import { LiveEventLog } from "@/components/diagnostics/live-event-log";
import { useLoopState } from "@/hooks/use-loop-state";

interface Props {
  deviceId: string | null;
  deviceName: string | null;
  initialLastSeenAt: string | null;
  initialIsOnline: boolean;
  initialIsRecent: boolean;
}

export function LiveConsole({
  deviceId,
  deviceName,
  initialLastSeenAt,
  initialIsOnline,
  initialIsRecent,
}: Props) {
  const {
    status,
    teensyState,
    activePhysical,
    flashNote,
    currentNote,
    noteHistory,
    fxState,
    loopState,
    loopStatus,
    log,
  } = useLiveConsoleSignals({ kind: "realtime", deviceId });

  const isFull = status === "full";

  return (
    <div className="space-y-4">
      <DeviceStatusBar
        initialLastSeenAt={initialLastSeenAt}
        initialIsOnline={initialIsOnline}
        initialIsRecent={initialIsRecent}
        deviceName={deviceName}
      />

      <ConsoleStatusRow status={status} teensy={teensyState} />

      {status === "awaiting" && <AwaitingCard />}
      {status === "agent_stale" && <AgentStaleCard />}

      {status !== "awaiting" && status !== "agent_stale" && (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border bg-card p-4">
              <VirtualKeyboard
                activePhysical={activePhysical}
                flashNote={flashNote}
                deviceId={deviceId}
                teensyInteractive={isFull}
              />
            </div>
            {isFull ? (
              <NoteReadout current={currentNote} history={noteHistory} />
            ) : (
              <TeensyBanner teensy={teensyState} />
            )}
          </div>

          {isFull && (
            <>
              <FxStatePanel state={fxState} />
              <LoopStatePanel loopState={loopState} status={loopStatus} />
            </>
          )}
        </>
      )}

      <LiveEventLog entries={log} />
    </div>
  );
}

function ConsoleStatusRow({
  status,
  teensy,
}: {
  status: ConsoleStatus;
  teensy: TeensyState;
}) {
  const piLabel =
    status === "awaiting" ? "starting…"
    : status === "agent_stale" ? "no response"
    : "streaming";
  const teensyLabel =
    teensy === "ok" ? "connected"
    : teensy === "missing" ? "not connected"
    : teensy === "busy" ? "busy (app running)"
    : "?";
  const piColor =
    status === "awaiting" ? "text-amber-400"
    : status === "agent_stale" ? "text-red-400"
    : "text-emerald-400";
  const teensyColor =
    teensy === "ok" ? "text-emerald-400"
    : teensy === "missing" ? "text-muted-foreground"
    : teensy === "busy" ? "text-amber-400"
    : "text-muted-foreground";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/60 px-4 py-2 text-xs">
      <span className="text-muted-foreground">Pi:</span>
      <span className={`font-mono font-semibold ${piColor}`}>{piLabel}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">Teensy:</span>
      <span className={`font-mono font-semibold ${teensyColor}`}>{teensyLabel}</span>
    </div>
  );
}

function AwaitingCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-6">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">Asking device to start streaming…</div>
        <div className="text-xs text-muted-foreground">
          The webapp is waiting for the Pi to acknowledge and begin sending telemetry.
        </div>
      </div>
    </div>
  );
}

function AgentStaleCard() {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-red-400" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-red-300">
            Device agent isn&apos;t responding
          </div>
          <div className="text-xs text-muted-foreground">
            The Pi&apos;s SyncAgent didn&apos;t answer within 10 seconds. Likely running an
            older version without Live Console support. Update the Pi and restart
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              sync_agent.py
            </code>
            then reopen this page.
          </div>
        </div>
      </div>
    </div>
  );
}

function TeensyBanner({ teensy }: { teensy: TeensyState }) {
  const variant = teensy === "busy" ? "busy" : "missing";
  const title = variant === "busy" ? "Teensy busy" : "Teensy not connected";
  const body =
    variant === "busy"
      ? "The Teensy is in use by the Ocarina app. Stop main.py on the Pi and reopen the console to debug the Teensy directly."
      : "Plug the Teensy into the Pi's USB to unlock notes, FX state, and loop tracks here. Pi GPIO buttons still work below.";
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <Usb className="mt-0.5 size-5 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{body}</div>
        </div>
      </div>
    </div>
  );
}

function LoopStatePanel({
  loopState,
  status,
}: {
  loopState: ReturnType<typeof useLoopState>["loopState"];
  status: ReturnType<typeof useLoopState>["status"];
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Loop engine</h2>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {status}
          {loopState.bpm ? ` · ${loopState.bpm} bpm` : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {loopState.tracks.map((t) => {
          const active = t.id === loopState.active_track;
          const color =
            t.state === "recording"
              ? "bg-red-500/15 border-red-500 text-red-100"
              : t.state === "playing"
              ? "bg-emerald-500/15 border-emerald-500 text-emerald-100"
              : t.state === "muted"
              ? "bg-muted/20 border-border text-muted-foreground"
              : "bg-background/40 border-border/60 text-muted-foreground/70";
          return (
            <div
              key={t.id}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs",
                color,
                active ? "ring-1 ring-amber-400/60" : "",
              ].join(" ")}
            >
              <span className="w-6 font-mono font-semibold">{t.id}</span>
              <span className="w-20 font-mono uppercase tracking-wider">
                {t.state}
              </span>
              <span className="flex-1 font-mono tabular-nums text-muted-foreground/80">
                {t.length_ms > 0 ? `${(t.length_ms / 1000).toFixed(2)}s` : "—"}
              </span>
              {t.muted && <span className="text-[10px] text-muted-foreground">MUTED</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
