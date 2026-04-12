"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Pattern, Step, Velocity } from "@/lib/audio/drum-engine";
import { VOICE_COUNT } from "@/lib/audio/drum-kit-manifest";

export const STEPS_PER_PATTERN = 16;
export const PATTERN_COUNT = 4;

export interface DrumPatternState {
  patterns: Pattern[];
  active: number;
  mutes: boolean[];
  solo: number | null;
  stepCursor: number;
  voiceCursor: number;
}

type Action =
  | { type: "TOGGLE_STEP"; voice: number; step: number }
  | { type: "CYCLE_VELOCITY"; voice: number; step: number }
  | { type: "SET_STEP"; voice: number; step: number; on: boolean; velocity?: Velocity }
  | { type: "CLEAR_PATTERN"; pattern?: number }
  | { type: "SWITCH_PATTERN"; index: number }
  | { type: "TOGGLE_MUTE"; voice: number }
  | { type: "TOGGLE_SOLO"; voice: number }
  | { type: "MOVE_CURSOR"; dStep?: number; dVoice?: number }
  | { type: "SET_CURSOR"; step?: number; voice?: number }
  | { type: "HYDRATE"; state: DrumPatternState };

function initialState(): DrumPatternState {
  return {
    patterns: Array.from({ length: PATTERN_COUNT }, emptyPattern),
    active: 0,
    mutes: new Array(VOICE_COUNT).fill(false),
    solo: null,
    stepCursor: 0,
    voiceCursor: 0,
  };
}

function emptyPattern(): Pattern {
  return Array.from({ length: VOICE_COUNT }, () =>
    Array.from({ length: STEPS_PER_PATTERN }, () => ({ on: false, velocity: 1 as Velocity }))
  );
}

function clonePattern(p: Pattern): Pattern {
  return p.map((row) => row.map((s) => ({ ...s })));
}

function withStep(
  state: DrumPatternState,
  voice: number,
  step: number,
  updater: (s: Step) => Step
): DrumPatternState {
  if (voice < 0 || voice >= VOICE_COUNT) return state;
  if (step < 0 || step >= STEPS_PER_PATTERN) return state;
  const patterns = state.patterns.slice();
  const target = clonePattern(patterns[state.active]);
  target[voice][step] = updater(target[voice][step]);
  patterns[state.active] = target;
  return { ...state, patterns };
}

function reducer(state: DrumPatternState, action: Action): DrumPatternState {
  switch (action.type) {
    case "TOGGLE_STEP":
      return withStep(state, action.voice, action.step, (s) => ({
        ...s,
        on: !s.on,
      }));
    case "CYCLE_VELOCITY":
      return withStep(state, action.voice, action.step, (s) => ({
        ...s,
        velocity: (((s.velocity + 1) % 3) as Velocity),
      }));
    case "SET_STEP":
      return withStep(state, action.voice, action.step, (s) => ({
        on: action.on,
        velocity: action.velocity ?? s.velocity,
      }));
    case "CLEAR_PATTERN": {
      const idx = action.pattern ?? state.active;
      const patterns = state.patterns.slice();
      patterns[idx] = emptyPattern();
      return { ...state, patterns };
    }
    case "SWITCH_PATTERN":
      if (action.index < 0 || action.index >= PATTERN_COUNT) return state;
      return { ...state, active: action.index };
    case "TOGGLE_MUTE": {
      if (action.voice < 0 || action.voice >= VOICE_COUNT) return state;
      const mutes = state.mutes.slice();
      mutes[action.voice] = !mutes[action.voice];
      return { ...state, mutes };
    }
    case "TOGGLE_SOLO": {
      if (action.voice < 0 || action.voice >= VOICE_COUNT) return state;
      return {
        ...state,
        solo: state.solo === action.voice ? null : action.voice,
      };
    }
    case "MOVE_CURSOR": {
      const step = clamp(
        state.stepCursor + (action.dStep ?? 0),
        0,
        STEPS_PER_PATTERN - 1
      );
      const voice = clamp(
        state.voiceCursor + (action.dVoice ?? 0),
        0,
        VOICE_COUNT - 1
      );
      return { ...state, stepCursor: step, voiceCursor: voice };
    }
    case "SET_CURSOR":
      return {
        ...state,
        stepCursor: action.step !== undefined ? clamp(action.step, 0, STEPS_PER_PATTERN - 1) : state.stepCursor,
        voiceCursor: action.voice !== undefined ? clamp(action.voice, 0, VOICE_COUNT - 1) : state.voiceCursor,
      };
    case "HYDRATE":
      return action.state;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const STORAGE_KEY_PREFIX = "drum-pattern-v1:";

export function useDrumPattern(persistKey = "local") {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const hydratedRef = useRef(false);
  const key = `${STORAGE_KEY_PREFIX}${persistKey}`;

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DrumPatternState;
        if (isValidState(parsed)) {
          dispatch({ type: "HYDRATE", state: parsed });
        }
      }
    } catch {
      // bad JSON — ignore, use defaults
    }
    hydratedRef.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // quota full or disabled — swallow
    }
  }, [state, key]);

  const activePattern = state.patterns[state.active];
  const effectiveMutes = state.solo !== null
    ? state.mutes.map((_, i) => i !== state.solo)
    : state.mutes;

  const toggleStep = useCallback((voice: number, step: number) => {
    dispatch({ type: "TOGGLE_STEP", voice, step });
  }, []);
  const cycleVelocity = useCallback((voice: number, step: number) => {
    dispatch({ type: "CYCLE_VELOCITY", voice, step });
  }, []);
  const setStep = useCallback(
    (voice: number, step: number, on: boolean, velocity?: Velocity) => {
      dispatch({ type: "SET_STEP", voice, step, on, velocity });
    },
    []
  );
  const clearPattern = useCallback((pattern?: number) => {
    dispatch({ type: "CLEAR_PATTERN", pattern });
  }, []);
  const switchPattern = useCallback((index: number) => {
    dispatch({ type: "SWITCH_PATTERN", index });
  }, []);
  const toggleMute = useCallback((voice: number) => {
    dispatch({ type: "TOGGLE_MUTE", voice });
  }, []);
  const toggleSolo = useCallback((voice: number) => {
    dispatch({ type: "TOGGLE_SOLO", voice });
  }, []);
  const moveCursor = useCallback((dStep?: number, dVoice?: number) => {
    dispatch({ type: "MOVE_CURSOR", dStep, dVoice });
  }, []);
  const setCursor = useCallback((step?: number, voice?: number) => {
    dispatch({ type: "SET_CURSOR", step, voice });
  }, []);

  return {
    state,
    activePattern,
    effectiveMutes,
    toggleStep,
    cycleVelocity,
    setStep,
    clearPattern,
    switchPattern,
    toggleMute,
    toggleSolo,
    moveCursor,
    setCursor,
  };
}

function isValidState(s: unknown): s is DrumPatternState {
  if (!s || typeof s !== "object") return false;
  const v = s as Partial<DrumPatternState>;
  if (!Array.isArray(v.patterns) || v.patterns.length !== PATTERN_COUNT) return false;
  if (!Array.isArray(v.mutes) || v.mutes.length !== VOICE_COUNT) return false;
  if (typeof v.active !== "number") return false;
  for (const p of v.patterns) {
    if (!Array.isArray(p) || p.length !== VOICE_COUNT) return false;
    for (const row of p) {
      if (!Array.isArray(row) || row.length !== STEPS_PER_PATTERN) return false;
    }
  }
  return true;
}
