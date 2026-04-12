"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, Download, RotateCcw } from "lucide-react";
import {
  configSections,
  defaultConfig,
  toNestedConfig,
  type ConfigField,
} from "@/lib/config/default-config";

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <button
        type="button"
        onClick={() => onChange(field.key, !value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(field.key, parseFloat(e.target.value))}
        min={field.min}
        max={field.max}
        step={field.step}
        className="w-28"
      />
    );
  }

  return (
    <Input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(field.key, e.target.value)}
      className="max-w-xs"
    />
  );
}

interface Props {
  initialConfig?: Record<string, unknown>;
  deviceId?: string;
}

export function ConfigForm({ initialConfig, deviceId }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    initialConfig ?? { ...defaultConfig }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState(configSections[0].id);

  function handleChange(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleReset() {
    setConfig({ ...defaultConfig });
    setSaved(false);
  }

  async function handleSave() {
    if (!deviceId) return;
    setSaving(true);
    try {
      const nested = toNestedConfig(config);
      const res = await fetch("/api/config/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, config: nested, configFlat: config }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadYaml() {
    const nested = toNestedConfig(config);
    const yaml = jsonToYaml(nested);
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.yaml";
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentSection = configSections.find((s) => s.id === activeSection)!;

  return (
    <div className="flex gap-6">
      {/* Section nav */}
      <nav className="hidden w-44 shrink-0 md:block">
        <div className="space-y-0.5">
          {configSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Section content */}
      <div className="flex-1 space-y-6">
        {/* Mobile section picker */}
        <div className="flex gap-2 overflow-x-auto md:hidden pb-2">
          {configSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                activeSection === section.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div>
          <h2 className="text-lg font-semibold">{currentSection.label}</h2>
          <p className="text-sm text-muted-foreground">{currentSection.description}</p>
        </div>

        <div className="space-y-4">
          {currentSection.fields.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                    {field.key}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{field.description}</p>
              </div>
              <div className="shrink-0">
                <ConfigFieldInput
                  field={field}
                  value={config[field.key]}
                  onChange={handleChange}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-4">
          {deviceId && (
            <Button onClick={handleSave} disabled={saving || saved} className="gap-1.5">
              <Save className="size-4" />
              {saved ? "Saved" : saving ? "Saving..." : "Save to Device"}
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadYaml} className="gap-1.5">
            <Download className="size-4" />
            Download YAML
          </Button>
          <Button variant="ghost" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-4" />
            Reset Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Simple JSON to YAML converter (good enough for flat config) */
function jsonToYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = "  ".repeat(indent);
  let yaml = "";
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      yaml += `${pad}${key}:\n`;
      yaml += jsonToYaml(value as Record<string, unknown>, indent + 1);
    } else if (typeof value === "string") {
      yaml += `${pad}${key}: "${value}"\n`;
    } else {
      yaml += `${pad}${key}: ${value}\n`;
    }
  }
  return yaml;
}
