"use client";

import {
  CONTROL_KEYS,
  configSections,
  defaultConfig,
  type ConfigField,
} from "@/lib/config/default-config";

interface Props {
  values: Record<string, unknown>;
  baseline: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Surfaces a curated subset of the existing dot-notation config keys as
 * "live tunables". The set is defined by CONTROL_KEYS so we don't have to
 * teach the Pi about new fields; this just promotes a few load-bearing
 * settings out of the YAML editor for fast iteration.
 */
export function ControlsSection({ values, baseline, onChange }: Props) {
  const fields = CONTROL_KEYS.map(findField).filter(
    (f): f is ConfigField => Boolean(f)
  );

  if (fields.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/10 px-4 py-3">
        <h2 className="text-sm font-medium">Live controls</h2>
        <p className="text-xs text-muted-foreground">
          Mic threshold, ducking, and other tunables. Applies along with button
          changes.
        </p>
      </div>

      <div className="divide-y">
        {fields.map((field) => {
          const value = values[field.key];
          const isChanged =
            String(baseline[field.key] ?? defaultConfig[field.key]) !== String(value);

          return (
            <div
              key={field.key}
              className={`flex items-start justify-between gap-4 px-4 py-3 ${
                isChanged ? "bg-primary/5" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                  {isChanged && (
                    <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
                  )}
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {field.description}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
                  {field.key}
                </p>
              </div>

              <div className="shrink-0">
                {field.type === "number" && (
                  <input
                    id={field.key}
                    type="number"
                    value={String(value ?? "")}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => onChange(field.key, Number(e.target.value))}
                    className="w-24 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                {field.type === "select" && (
                  <select
                    id={field.key}
                    value={String(value ?? "")}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === "boolean" && (
                  <button
                    type="button"
                    onClick={() => onChange(field.key, !value)}
                    className={[
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      value ? "bg-primary" : "bg-muted-foreground/30",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                        value ? "translate-x-4" : "translate-x-0.5",
                      ].join(" ")}
                    />
                  </button>
                )}
                {field.type === "string" && (
                  <input
                    id={field.key}
                    type="text"
                    value={String(value ?? "")}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="w-40 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function findField(key: string): ConfigField | undefined {
  for (const section of configSections) {
    const field = section.fields.find((f) => f.key === key);
    if (field) return field;
  }
  return undefined;
}
