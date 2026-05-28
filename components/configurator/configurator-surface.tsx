"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  ocarina,
  type ButtonState,
  type PresetIndex,
  type StatusResponse,
} from "@/lib/ocarina-api";
import { usePiRestTeensy } from "@/hooks/use-pi-rest-teensy";
import type { HardwareEvent } from "@/hooks/use-hardware-input";

import { PiRestStatusCard } from "@/components/monitor/pi-rest-status-card";
import { PiButtonGrid } from "@/components/configurator/pi-button-grid";
import { PresetRow } from "@/components/configurator/preset-row";
import { NOTE_BUTTONS } from "@/lib/hardware/button-layout";

/**
 * Pi-REST-only configurator. Owns no persistent state of its own — every read
 * goes through GET /status, every write through POST /map (or the preset
 * endpoints), and live press flashes come from the same /events WebSocket the
 * monitor uses.
 */
export function ConfiguratorSurface() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [builtin, setBuiltin] = useState<PresetIndex>({});
  const [user, setUser] = useState<PresetIndex>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState<Set<number>>(new Set());

  // Live press flashes: NOTE_BUTTONS pin order matches Pi button 1..N for the
  // 8-pin firmware. The Pi sends note_off with `button: 1..12`; map back by
  // resolving the pin → NOTE_BUTTONS index.
  const onHardware = useCallback((ev: HardwareEvent) => {
    if (typeof ev.button !== "number") return;
    const idx = NOTE_BUTTONS.findIndex((b) => b.pin === ev.button);
    const buttonNum = idx >= 0 ? idx + 1 : ev.button;
    if (ev.event === "release") {
      setPressed((prev) => {
        const next = new Set(prev);
        next.add(buttonNum);
        return next;
      });
      // Auto-clear after a short window so the visual fires once per press.
      setTimeout(() => {
        setPressed((prev) => {
          const next = new Set(prev);
          next.delete(buttonNum);
          return next;
        });
      }, 120);
    }
  }, []);

  const piRest = usePiRestTeensy({ enabled: true, onHardware });

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, b, u] = await Promise.all([
        ocarina.status(),
        ocarina.listPresets(),
        ocarina.listUserPresets(),
      ]);
      setStatus(s);
      setBuiltin(b);
      setUser(u);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Refetch /status when the WS reconnects — covers writes that happened
  // while disconnected.
  const piStatus = piRest.status;
  useEffect(() => {
    if (piStatus === "connected") void ocarina.status().then(setStatus).catch(() => {});
  }, [piStatus]);

  const withBusy = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setLoadError(null);
      try {
        return await fn();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  // Every write endpoint returns a narrow confirmation, not the new status.
  // Refetch /status after each mutating call to keep the grid honest.
  const refreshStatus = useCallback(async () => {
    setStatus(await ocarina.status());
  }, []);

  const handleAssign = useCallback(
    async (button: number, value: string) => {
      await withBusy(async () => {
        await ocarina.setButton(button, value);
        await refreshStatus();
      });
    },
    [withBusy, refreshStatus]
  );

  const handleApplyBuiltin = useCallback(
    async (name: string) =>
      withBusy(async () => {
        await ocarina.applyPreset(name);
        await refreshStatus();
      }),
    [withBusy, refreshStatus]
  );

  const handleApplyUser = useCallback(
    async (name: string) =>
      withBusy(async () => {
        await ocarina.applyUserPreset(name);
        await refreshStatus();
      }),
    [withBusy, refreshStatus]
  );

  const handleSaveUser = useCallback(
    async (name: string) =>
      withBusy(async () => {
        await ocarina.saveUserPreset(name);
        const u = await ocarina.listUserPresets();
        setUser(u);
      }),
    [withBusy]
  );

  const handleDeleteUser = useCallback(
    async (name: string) =>
      withBusy(async () => {
        await ocarina.deleteUserPreset(name);
        const u = await ocarina.listUserPresets();
        setUser(u);
      }),
    [withBusy]
  );

  const handleReapply = useCallback(
    async () =>
      withBusy(async () => {
        await ocarina.reapplyPersisted();
        await refreshStatus();
      }),
    [withBusy, refreshStatus]
  );

  const handleClearAll = useCallback(
    async () =>
      withBusy(async () => {
        await ocarina.clearAll();
        await refreshStatus();
      }),
    [withBusy, refreshStatus]
  );

  const overrideCount = countOverrides(status?.buttons ?? []);

  return (
    <div className="space-y-4">
      <PiRestStatusCard piRest={piRest} />

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-red-400" />
          <div>
            <div className="font-medium text-red-300">{loadError}</div>
            <button
              type="button"
              onClick={() => { void loadAll(); }}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <PresetRow
        builtin={builtin}
        user={user}
        isBusy={busy}
        currentButtons={status?.buttons ?? []}
        onApplyBuiltin={handleApplyBuiltin}
        onApplyUser={handleApplyUser}
        onSaveUser={handleSaveUser}
        onDeleteUser={handleDeleteUser}
        onReapply={handleReapply}
        onClearAll={handleClearAll}
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-medium">Button assignments</h2>
            <p className="text-xs text-muted-foreground">
              {status
                ? `${status.buttons.length} buttons · ${overrideCount} override${overrideCount === 1 ? "" : "s"}`
                : "Loading…"}
            </p>
          </div>
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {status ? (
          <PiButtonGrid
            buttons={status.buttons}
            pressed={pressed}
            onAssign={handleAssign}
          />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-border bg-card/50"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function countOverrides(buttons: ButtonState[]): number {
  let n = 0;
  for (const b of buttons) if (b.overridden) n += 1;
  return n;
}
