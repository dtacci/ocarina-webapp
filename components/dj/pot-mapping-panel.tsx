"use client";

/**
 * Hardware assignment strip: which physical pot drives which DJ control, and
 * what the Pi GPIO buttons trigger. Two compact rows — DJing is the point,
 * not configuration.
 */
import type {
  DjButtonTarget,
  DjPotMapping,
  PotAssignment,
} from "@/hooks/use-dj-hardware";
import type { PiGpioName } from "@/lib/ocarina-api";
import type { PiRestStatus } from "@/hooks/use-pi-rest-teensy";

const POT_OPTIONS: { value: PotAssignment; label: string }[] = [
  { value: "off", label: "off" },
  { value: "pitch_bend", label: "bend knob" },
  { value: "volume", label: "volume knob" },
  { value: "reverb_mix", label: "reverb knob" },
  { value: "filter", label: "filter knob" },
];

const POT_CONTROLS: {
  key: "crossfader" | "masterVolume" | "deckFilter";
  label: string;
}[] = [
  { key: "crossfader", label: "crossfader" },
  { key: "masterVolume", label: "master" },
  { key: "deckFilter", label: "deck filter" },
];

const BUTTON_OPTIONS: { value: DjButtonTarget; label: string }[] = [
  { value: "off", label: "off" },
  { value: "hotcue1", label: "hot cue 1" },
  { value: "hotcue2", label: "hot cue 2" },
  { value: "hotcue3", label: "hot cue 3" },
  { value: "hotcue4", label: "hot cue 4" },
  { value: "playToggle", label: "play/pause" },
];

const GPIO_BUTTONS: { key: PiGpioName; label: string }[] = [
  { key: "inst_1", label: "inst 1" },
  { key: "inst_2", label: "inst 2" },
  { key: "inst_3", label: "inst 3" },
  { key: "inst_4", label: "inst 4" },
  { key: "voice", label: "voice" },
];

export interface PotMappingPanelProps {
  hwStatus: PiRestStatus;
  hwConfigured: boolean;
  mapping: DjPotMapping;
  onChange: (patch: Partial<DjPotMapping>) => void;
}

const selectClass =
  "border border-[color:var(--wb-line)] bg-[color:var(--ink-900)] px-1.5 py-1 text-xs text-[color:var(--ink-300)] lowercase focus:outline-none focus:ring-1 focus:ring-[color:var(--wb-amber-dim)]";

export function PotMappingPanel({
  hwStatus,
  hwConfigured,
  mapping,
  onChange,
}: PotMappingPanelProps) {
  const connected = hwStatus === "connected";
  return (
    <div className="space-y-2 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2">
          <span className="workbench-led" data-on={connected} />
          <span className="workbench-label text-[10px]">
            ocarina {hwConfigured ? hwStatus : "not configured"}
          </span>
        </span>
        {POT_CONTROLS.map((c) => (
          <label key={c.key} className="flex items-center gap-2">
            <span className="workbench-label text-[10px] text-[color:var(--ink-500)]">{c.label} ←</span>
            <select
              value={mapping[c.key]}
              onChange={(e) => onChange({ [c.key]: e.target.value as PotAssignment })}
              className={selectClass}
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="workbench-label text-[10px] text-[color:var(--ink-500)]">
          buttons → favored deck
        </span>
        {GPIO_BUTTONS.map((b) => (
          <label key={b.key} className="flex items-center gap-2">
            <span className="workbench-label text-[10px] text-[color:var(--ink-500)]">{b.label} →</span>
            <select
              value={mapping.buttons[b.key]}
              onChange={(e) =>
                onChange({
                  buttons: {
                    ...mapping.buttons,
                    [b.key]: e.target.value as DjButtonTarget,
                  },
                })
              }
              className={selectClass}
            >
              {BUTTON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
