"use client";

/**
 * Hardware knob assignment: which physical pot drives which DJ control.
 * Collapsed into a small strip — DJing is the point, not configuration.
 */
import type { DjPotMapping, PotAssignment } from "@/hooks/use-dj-hardware";
import type { PiRestStatus } from "@/hooks/use-pi-rest-teensy";

const POT_OPTIONS: { value: PotAssignment; label: string }[] = [
  { value: "off", label: "off" },
  { value: "pitch_bend", label: "bend knob" },
  { value: "volume", label: "volume knob" },
  { value: "reverb_mix", label: "reverb knob" },
  { value: "filter", label: "filter knob" },
];

const CONTROLS: { key: keyof DjPotMapping; label: string }[] = [
  { key: "crossfader", label: "crossfader" },
  { key: "masterVolume", label: "master" },
  { key: "deckFilter", label: "deck filter" },
];

export interface PotMappingPanelProps {
  hwStatus: PiRestStatus;
  hwConfigured: boolean;
  mapping: DjPotMapping;
  onChange: (patch: Partial<DjPotMapping>) => void;
}

export function PotMappingPanel({
  hwStatus,
  hwConfigured,
  mapping,
  onChange,
}: PotMappingPanelProps) {
  const connected = hwStatus === "connected";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-4 py-2.5">
      <span className="flex items-center gap-2">
        <span className="workbench-led" data-on={connected} />
        <span className="workbench-label text-[10px]">
          ocarina {hwConfigured ? hwStatus : "not configured"}
        </span>
      </span>
      {CONTROLS.map((c) => (
        <label key={c.key} className="flex items-center gap-2">
          <span className="workbench-label text-[10px] text-[color:var(--ink-500)]">{c.label} ←</span>
          <select
            value={mapping[c.key]}
            onChange={(e) => onChange({ [c.key]: e.target.value as PotAssignment })}
            className="border border-[color:var(--wb-line)] bg-[color:var(--ink-900)] px-1.5 py-1 text-xs text-[color:var(--ink-300)] lowercase focus:outline-none focus:ring-1 focus:ring-[color:var(--wb-amber-dim)]"
          >
            {POT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
