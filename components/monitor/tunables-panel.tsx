"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Check, AlertTriangle, Sliders, WifiOff } from "lucide-react";

interface Field {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const FIELDS: Field[] = [
  {
    key: "vad.silence_duration",
    label: "Mic silence threshold",
    description: "Seconds of silence before VAD ends a phrase. Lower = snappier, higher = more forgiving.",
    min: 0.1,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}s`,
  },
  {
    key: "vad.aggressiveness",
    label: "VAD aggressiveness",
    description: "0 (least aggressive) – 3 (most). Higher rejects more borderline audio.",
    min: 0,
    max: 3,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "tts.ducking.duck_level",
    label: "TTS duck level",
    description: "Music volume when TTS speaks. 0 = full duck, 1 = no duck.",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
  },
];

interface Props {
  deviceId: string;
  deviceName: string | null;
  initialValues: Record<string, unknown>;
  initialConfigVersion: number;
}

type SaveState = "idle" | "saving" | "applied" | "queued" | "error";

/**
 * Live VAD / ducking tuner. Each slider PATCHes /api/sync/config with the
 * single changed key (debounced). The PATCH writes a new device_configs
 * version and queues a `set_config_field` command per change — the legacy
 * sync_agent.py path picks them up when running. Pi-REST mode will eventually
 * own its own endpoints; until then this is the bridge.
 */
export function TunablesPanel({
  deviceId,
  deviceName,
  initialValues,
  initialConfigVersion,
}: Props) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const f of FIELDS) {
      const v = initialValues[f.key];
      out[f.key] = typeof v === "number" ? v : Number(v) || f.min;
    }
    return out;
  });
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(initialConfigVersion);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const flush = useCallback(
    async (key: string, value: number) => {
      setState("saving");
      setError(null);
      try {
        const res = await fetch("/api/sync/config", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId, changes: { [key]: value } }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`${res.status}: ${body || res.statusText}`);
        }
        const body = (await res.json()) as { version?: number; queued?: number };
        if (typeof body.version === "number") setVersion(body.version);
        // We don't know online status here without an extra fetch; treat
        // non-error responses as queued — sync_agent.py picks them up when it
        // polls. The /devices/[id]/config page does richer status reporting.
        setState("queued");
        setTimeout(() => setState("idle"), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "PATCH failed");
        setState("error");
      }
    },
    [deviceId]
  );

  function setLocal(key: string, value: number) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void flush(key, value); }, 400);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <Sliders className="size-3.5 text-muted-foreground" />
            Live tunables
          </h2>
          <p className="text-xs text-muted-foreground">
            Writes to <span className="font-mono">{deviceName ?? "device"}</span>{" "}
            via the legacy config sync path. Config v{version}.
          </p>
        </div>
        <SaveBadge state={state} error={error} />
      </div>

      <div className="space-y-3">
        {FIELDS.map((f) => {
          const v = values[f.key];
          return (
            <div key={f.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={f.key}
                  className="text-xs font-medium"
                >
                  {f.label}
                </label>
                <span className="font-mono text-[11px] tabular-nums text-foreground/80">
                  {(f.format ?? String)(v)}
                </span>
              </div>
              <input
                id={f.key}
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={v}
                onChange={(e) => setLocal(f.key, Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <p className="text-[10px] text-muted-foreground/70">{f.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SaveBadge({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> saving…
      </span>
    );
  }
  if (state === "queued") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] text-amber-400">
        <WifiOff className="size-3" /> queued
      </span>
    );
  }
  if (state === "applied") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
        <Check className="size-3" /> applied
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="flex items-center gap-1 font-mono text-[10px] text-red-400"
        title={error ?? undefined}
      >
        <AlertTriangle className="size-3" /> failed
      </span>
    );
  }
  return null;
}
