"use client";

import { useState } from "react";
import { Check, Loader2, ChevronDown, ChevronUp, WifiOff } from "lucide-react";
import { configSections, defaultConfig } from "@/lib/config/default-config";

interface Props {
  deviceId: string;
  currentConfig: Record<string, unknown>;
  configVersion: number;
  configSource: string;
  isOnline: boolean;
}

type Status = "idle" | "saving" | "queued" | "applied" | "error";

export function ConfigForm({
  deviceId,
  currentConfig,
  configVersion,
  configSource,
  isOnline,
}: Props) {
  // Draft values — start from current config, fall back to defaults
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
    ...defaultConfig,
    ...currentConfig,
  }));
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["voice", "whisper", "tts", "llm"])
  );
  const [status, setStatus] = useState<Status>("idle");
  const [savedVersion, setSavedVersion] = useState(configVersion);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setValue(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Compute only the fields that changed from currentConfig
  function getChanges(): Record<string, unknown> {
    const base = { ...defaultConfig, ...currentConfig };
    const changes: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(draft)) {
      if (String(base[key]) !== String(val)) {
        changes[key] = val;
      }
    }
    return changes;
  }

  async function handleSave() {
    const changes = getChanges();
    if (Object.keys(changes).length === 0) return;

    setStatus("saving");
    try {
      const res = await fetch("/api/sync/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, changes }),
      });
      if (!res.ok) throw new Error();
      const { version } = await res.json();
      setSavedVersion(version);
      setStatus(isOnline ? "applied" : "queued");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const changes = getChanges();
  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="space-y-3">
      {/* Version / source indicator */}
      <p className="text-xs text-muted-foreground">
        Config v{savedVersion}
        {configSource !== "default" && ` · last set via ${configSource}`}
      </p>

      {/* Section accordion */}
      {configSections.map((section) => (
        <div key={section.id} className="rounded-lg border bg-card overflow-hidden">
          <button
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium">{section.label}</p>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            {openSections.has(section.id)
              ? <ChevronUp className="size-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            }
          </button>

          {openSections.has(section.id) && (
            <div className="border-t divide-y">
              {section.fields.map((field) => {
                const value = draft[field.key];
                const isChanged = String(currentConfig[field.key] ?? defaultConfig[field.key]) !== String(value);

                return (
                  <div key={field.key} className={`flex items-start justify-between gap-4 px-4 py-3 ${isChanged ? "bg-primary/5" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <label htmlFor={field.key} className="text-sm font-medium">
                        {field.label}
                        {isChanged && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />}
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                    </div>

                    <div className="shrink-0">
                      {field.type === "boolean" && (
                        <button
                          onClick={() => setValue(field.key, !value)}
                          className={[
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            value ? "bg-primary" : "bg-muted-foreground/30",
                          ].join(" ")}
                        >
                          <span className={[
                            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                            value ? "translate-x-4" : "translate-x-0.5",
                          ].join(" ")} />
                        </button>
                      )}

                      {field.type === "select" && (
                        <select
                          id={field.key}
                          value={String(value ?? "")}
                          onChange={(e) => setValue(field.key, e.target.value)}
                          className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "number" && (
                        <input
                          id={field.key}
                          type="number"
                          value={String(value ?? "")}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          onChange={(e) => setValue(field.key, Number(e.target.value))}
                          className="w-24 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}

                      {field.type === "string" && (
                        <input
                          id={field.key}
                          type="text"
                          value={String(value ?? "")}
                          onChange={(e) => setValue(field.key, e.target.value)}
                          className="w-40 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-lg">
        <div className="text-sm">
          {status === "idle" && hasChanges && (
            <span className="text-muted-foreground">{Object.keys(changes).length} unsaved change{Object.keys(changes).length !== 1 ? "s" : ""}</span>
          )}
          {status === "saving" && (
            <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Saving…</span>
          )}
          {status === "applied" && (
            <span className="flex items-center gap-1.5 text-emerald-600"><Check className="size-3.5" />Applied — Pi will use new settings</span>
          )}
          {status === "queued" && (
            <span className="flex items-center gap-1.5 text-muted-foreground"><WifiOff className="size-3.5" />Queued — will apply when Ocarina reconnects</span>
          )}
          {status === "error" && (
            <span className="text-destructive">Save failed — try again</span>
          )}
          {status === "idle" && !hasChanges && (
            <span className="text-muted-foreground text-xs">No changes</span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges || status === "saving"}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
}
