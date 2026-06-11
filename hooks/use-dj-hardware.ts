"use client";

/**
 * Maps the ocarina's physical pots onto DJ-mode controls via the high-rate
 * "pots" event stream (Phase 1 of the DJ build; ~30 Hz while a knob moves).
 *
 * The mapping is a per-browser preference (localStorage) — it configures one
 * physical device sitting next to one screen, so the DB stays out of it.
 * Default: the pitch-bend pot drives the crossfader — its centered-rest usage
 * matches a crossfader's center detent, and it's the least valuable synth
 * knob while decks are playing.
 *
 * Callbacks fire straight from the WebSocket handler at pot rate: keep them
 * setState-free (drive rampTo / refs / canvas) — same contract as `onPots`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePiRestTeensy, type PiRestStatus } from "@/hooks/use-pi-rest-teensy";
import type { PiGpioName, PotsEvent } from "@/lib/ocarina-api";

export type PotName = "volume" | "reverb_mix" | "filter" | "pitch_bend";
export type PotAssignment = PotName | "off";

/** What a Pi GPIO button can trigger in DJ mode. */
export type DjButtonTarget =
  | "off"
  | "hotcue1"
  | "hotcue2"
  | "hotcue3"
  | "hotcue4"
  | "playToggle";

export interface DjPotMapping {
  crossfader: PotAssignment;
  masterVolume: PotAssignment;
  /** Filter sweep on whichever deck is focused in the UI. */
  deckFilter: PotAssignment;
  /** Pi GPIO row → pad/transport actions (on the crossfader-favored deck). */
  buttons: Record<PiGpioName, DjButtonTarget>;
}

export const DEFAULT_DJ_MAPPING: DjPotMapping = {
  crossfader: "pitch_bend",
  masterVolume: "off",
  deckFilter: "off",
  buttons: {
    inst_1: "hotcue1",
    inst_2: "hotcue2",
    inst_3: "hotcue3",
    inst_4: "hotcue4",
    voice: "playToggle",
  },
};

const STORAGE_KEY = "dj-pot-mapping-v1";

function loadMapping(): DjPotMapping {
  if (typeof window === "undefined") return DEFAULT_DJ_MAPPING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DJ_MAPPING;
    const parsed = JSON.parse(raw) as Partial<DjPotMapping>;
    // Deep-merge `buttons` so pre-button saved mappings stay valid.
    return {
      ...DEFAULT_DJ_MAPPING,
      ...parsed,
      buttons: { ...DEFAULT_DJ_MAPPING.buttons, ...(parsed.buttons ?? {}) },
    };
  } catch {
    return DEFAULT_DJ_MAPPING;
  }
}

export interface UseDjHardwareOptions {
  /** Pot value already normalized to 0..1. High-rate — no setState inside. */
  onCrossfade?: (v: number) => void;
  onMasterVolume?: (v: number) => void;
  onDeckFilter?: (v: number) => void;
  /** Hot cue pad i (0–3) pressed on hardware. Fired on press only. */
  onHotCue?: (i: number) => void;
  onPlayToggle?: () => void;
}

export interface UseDjHardware {
  /** Pi link status — drives the "HW" LED. */
  hwStatus: PiRestStatus;
  hwConfigured: boolean;
  mapping: DjPotMapping;
  setMapping: (patch: Partial<DjPotMapping>) => void;
  /** Wall-clock of the last pot event; null until one arrives. */
  lastPotAtRef: React.RefObject<number | null>;
  /** Suppress pot→control routing until this wall-clock ms (manual override). */
  suppressUntilRef: React.RefObject<number>;
}

export function useDjHardware(options: UseDjHardwareOptions): UseDjHardware {
  const [mapping, setMappingState] = useState<DjPotMapping>(loadMapping);
  const mappingRef = useRef(mapping);
  useEffect(() => { mappingRef.current = mapping; }, [mapping]);

  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const lastPotAtRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);

  const onPots = useCallback((e: PotsEvent) => {
    lastPotAtRef.current = Date.now();
    if (Date.now() < suppressUntilRef.current) return;
    const m = mappingRef.current;
    const o = optionsRef.current;
    const route = (assignment: PotAssignment, cb?: (v: number) => void) => {
      if (assignment === "off" || !cb) return;
      cb(Math.max(0, Math.min(1, e[assignment] / 100)));
    };
    route(m.crossfader, o.onCrossfade);
    route(m.masterVolume, o.onMasterVolume);
    route(m.deckFilter, o.onDeckFilter);
  }, []);

  // Buttons skip the suppression window (it exists to stop a pot fighting an
  // on-screen drag; a button press is a discrete intent).
  const onGpioButton = useCallback((name: string, pressed: boolean) => {
    if (!pressed) return;
    const target = mappingRef.current.buttons[name as PiGpioName];
    const o = optionsRef.current;
    if (!target || target === "off") return;
    if (target === "playToggle") {
      o.onPlayToggle?.();
    } else {
      o.onHotCue?.(Number(target.slice(-1)) - 1);
    }
  }, []);

  const { status, isConfigured } = usePiRestTeensy({ onPots, onGpioButton });

  const setMapping = useCallback((patch: Partial<DjPotMapping>) => {
    setMappingState((prev) => {
      const next = {
        ...prev,
        ...patch,
        buttons: { ...prev.buttons, ...(patch.buttons ?? {}) },
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode etc. — mapping just won't persist */
      }
      return next;
    });
  }, []);

  return {
    hwStatus: status,
    hwConfigured: isConfigured,
    mapping,
    setMapping,
    lastPotAtRef,
    suppressUntilRef,
  };
}
