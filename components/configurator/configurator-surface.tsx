"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, WifiOff, AlertTriangle, Save } from "lucide-react";

import {
  CONTROL_KEYS,
  defaultButtonsConfig,
  defaultConfig,
  type ButtonsConfig,
} from "@/lib/config/default-config";
import type { ButtonAction } from "@/lib/config/button-actions";
import { applyConfiguration } from "@/lib/config/apply-configuration";

import { ProfileBar } from "@/components/configurator/profile-bar";
import { ButtonGrid } from "@/components/configurator/button-grid";
import { ControlsSection } from "@/components/configurator/controls-section";

interface Props {
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  currentConfig: Record<string, unknown>;
  configVersion: number;
  configSource: string;
}

type Status = "idle" | "saving" | "queued" | "applied" | "error";

export function ConfiguratorSurface({
  deviceId,
  deviceName,
  isOnline,
  currentConfig,
  configVersion,
  configSource,
}: Props) {
  // Hydrate the live "buttons" config from the merged baseline.
  const initialButtons = useMemo<ButtonsConfig>(() => {
    const fromServer = currentConfig.buttons as ButtonsConfig | undefined;
    if (fromServer && fromServer.profiles && fromServer.activeProfileId) {
      return fromServer;
    }
    return defaultButtonsConfig;
  }, [currentConfig]);

  const initialControls = useMemo<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    for (const k of CONTROL_KEYS) {
      out[k] = currentConfig[k] ?? defaultConfig[k];
    }
    return out;
  }, [currentConfig]);

  const [draftButtons, setDraftButtons] = useState<ButtonsConfig>(initialButtons);
  const [draftControls, setDraftControls] = useState(initialControls);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(configVersion);

  const activeProfile = draftButtons.profiles[draftButtons.activeProfileId];

  function patchButtons(updater: (prev: ButtonsConfig) => ButtonsConfig) {
    setDraftButtons(updater);
  }

  function setActiveProfileId(id: string) {
    patchButtons((b) => ({ ...b, activeProfileId: id, overrides: {} }));
  }

  function assignOverride(buttonId: string, action: ButtonAction) {
    patchButtons((b) => ({
      ...b,
      overrides: { ...b.overrides, [buttonId]: action },
    }));
  }

  function clearOverride(buttonId: string) {
    patchButtons((b) => {
      const next = { ...b.overrides };
      delete next[buttonId];
      return { ...b, overrides: next };
    });
  }

  function renameProfile(id: string, name: string) {
    patchButtons((b) => ({
      ...b,
      profiles: { ...b.profiles, [id]: { ...b.profiles[id], name } },
    }));
  }

  function duplicateProfile(id: string) {
    patchButtons((b) => {
      const source = b.profiles[id];
      if (!source) return b;
      const newId = uniqueId(id, b.profiles);
      return {
        ...b,
        profiles: {
          ...b.profiles,
          [newId]: { name: `${source.name} copy`, mapping: { ...source.mapping } },
        },
        activeProfileId: newId,
        overrides: {},
      };
    });
  }

  function deleteProfile(id: string) {
    patchButtons((b) => {
      const ids = Object.keys(b.profiles);
      if (ids.length <= 1) return b;
      const next = { ...b.profiles };
      delete next[id];
      const fallback = b.activeProfileId === id ? ids.find((x) => x !== id)! : b.activeProfileId;
      return { ...b, profiles: next, activeProfileId: fallback, overrides: {} };
    });
  }

  function setControl(key: string, value: unknown) {
    setDraftControls((prev) => ({ ...prev, [key]: value }));
  }

  // Diff vs server baseline → changeset for PATCH.
  const changes = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (JSON.stringify(draftButtons) !== JSON.stringify(initialButtons)) {
      out.buttons = draftButtons;
    }
    for (const k of CONTROL_KEYS) {
      if (String(draftControls[k]) !== String(initialControls[k])) {
        out[k] = draftControls[k];
      }
    }
    return out;
  }, [draftButtons, initialButtons, draftControls, initialControls]);

  const hasChanges = Object.keys(changes).length > 0;

  async function handleApply() {
    if (!hasChanges) return;
    setStatus("saving");
    setErrMsg(null);
    try {
      const result = await applyConfiguration({ deviceId, changes, mode: "apply" });
      setSavedVersion(result.version);
      setStatus(isOnline ? "applied" : "queued");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e) {
      setStatus("error");
      setErrMsg(e instanceof Error ? e.message : "Failed to apply changes");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/60 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Device:</span>
          <span className="font-medium">{deviceName}</span>
          <span className="text-muted-foreground">·</span>
          <span
            className={`font-mono uppercase tracking-wider ${
              isOnline ? "text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {isOnline ? "online" : "offline"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            config v{savedVersion}
            {configSource !== "default" ? ` · ${configSource}` : ""}
          </span>
        </div>

        <StatusBadge status={status} hasChanges={hasChanges} changeCount={Object.keys(changes).length} />
      </div>

      <ProfileBar
        profiles={draftButtons.profiles}
        activeId={draftButtons.activeProfileId}
        onActiveChange={setActiveProfileId}
        onRename={renameProfile}
        onDuplicate={duplicateProfile}
        onDelete={deleteProfile}
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-medium">Button assignments</h2>
            <p className="text-xs text-muted-foreground">
              Showing <span className="text-foreground">{activeProfile?.name ?? "—"}</span> with{" "}
              {Object.keys(draftButtons.overrides).length} override
              {Object.keys(draftButtons.overrides).length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
        <ButtonGrid
          baseMapping={activeProfile?.mapping ?? {}}
          overrides={draftButtons.overrides}
          onAssign={assignOverride}
          onClearOverride={clearOverride}
        />
      </div>

      <ControlsSection
        values={draftControls}
        baseline={initialControls}
        onChange={setControl}
      />

      {/* Sticky save bar */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-lg">
        <div className="text-sm">
          {errMsg && status === "error" && (
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertTriangle className="size-3.5" />
              {errMsg}
            </span>
          )}
          {status === "idle" && hasChanges && (
            <span className="text-muted-foreground">
              {Object.keys(changes).length} unsaved change
              {Object.keys(changes).length !== 1 ? "s" : ""}
            </span>
          )}
          {status === "idle" && !hasChanges && (
            <span className="text-muted-foreground">No changes</span>
          )}
          {status === "saving" && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </span>
          )}
          {status === "applied" && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check className="size-3.5" />
              Applied — Pi will pick this up
            </span>
          )}
          {status === "queued" && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <WifiOff className="size-3.5" />
              Queued — will apply when device reconnects
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!hasChanges || status === "saving"}
          onClick={handleApply}
          className="flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-3.5" />
          Apply
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  hasChanges,
  changeCount,
}: {
  status: Status;
  hasChanges: boolean;
  changeCount: number;
}) {
  if (status === "saving") {
    return <span className="font-mono text-muted-foreground">saving…</span>;
  }
  if (status === "applied") {
    return <span className="font-mono text-emerald-400">applied</span>;
  }
  if (status === "queued") {
    return <span className="font-mono text-amber-400">queued</span>;
  }
  if (hasChanges) {
    return (
      <span className="font-mono text-amber-400">
        {changeCount} pending
      </span>
    );
  }
  return <span className="font-mono text-muted-foreground">in sync</span>;
}

function uniqueId(base: string, existing: Record<string, unknown>): string {
  let i = 2;
  while (`${base}_${i}` in existing) i += 1;
  return `${base}_${i}`;
}
