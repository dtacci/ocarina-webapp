/**
 * Two-deck DJ engine on top of the shared master-out pattern.
 *
 * Topology:
 *   deck: Tone.Player → Tone.EQ3 (kill EQ) → Tone.Filter (bipolar sweep)
 *           → deck fader Gain → crossfade Gain → post-fade Analyser → master
 *   master: Gain → Analyser → Destination
 *
 * Design choices:
 *  - FIXED per-deck strip (not an EffectNode[] pedalboard): DJ workflows want
 *    stable knobs, and a fixed topology can never hit the structural-rebuild
 *    path mid-set — every tweak is a glitch-free param ramp.
 *  - Manual equal-power crossfade (cos/sin gain pair) instead of
 *    Tone.CrossFade: the per-side gains stay tappable, so each deck gets a
 *    POST-crossfade analyser — the meters (and the e2e verify script) can see
 *    the fader actually attenuating a deck.
 *  - All audible changes ramp (~50–60 ms); the hardware pot handler feeds
 *    setCrossfade at ~30 Hz and the ramps stitch the steps together.
 *
 * Position tracking is manual (Tone.Player has no playhead): anchor the
 * context time whenever playback state or rate changes.
 */
import * as Tone from "tone";

const RAMP_SEC = 0.05;

export type DeckId = "a" | "b";
export type EqBand = "low" | "mid" | "high";

export interface DeckMeta {
  title: string;
  bpm?: number | null;
}

export interface DeckState {
  loaded: boolean;
  title: string | null;
  bpm: number | null;
  durationSec: number;
  playing: boolean;
  positionSec: number;
  /** Playback rate, 1 = native. Nudge range is enforced by the UI. */
  rate: number;
  loop: boolean;
  cueSec: number;
  eq: Record<EqBand, number>;
  /** Bipolar filter knob: -1 (LP closed) .. 0 (off) .. 1 (HP closed). */
  filter: number;
  volume: number;
}

export interface DjDeck {
  /** Post-crossfade meter tap — reflects what this deck contributes to the mix. */
  analyser: Tone.Analyser;
  load: (buffer: AudioBuffer, meta: DeckMeta) => void;
  play: (fromSec?: number) => void;
  pause: () => void;
  toggle: () => void;
  seek: (sec: number) => void;
  /** Set the cue point (defaults to the current position). */
  setCue: (sec?: number) => void;
  /** Jump to the cue point, preserving play/pause state. */
  jumpCue: () => void;
  setRate: (rate: number) => void;
  setLoop: (on: boolean) => void;
  setEq: (band: EqBand, db: number) => void;
  setFilter: (v: number) => void;
  setVolume: (v: number) => void;
  getState: () => DeckState;
}

export interface DjEngine {
  decks: Record<DeckId, DjDeck>;
  /** 0 = full deck A, 1 = full deck B. Equal-power. */
  setCrossfade: (x: number, rampSec?: number) => void;
  getCrossfade: () => number;
  setMasterVolume: (v: number) => void;
  masterAnalyser: Tone.Analyser;
  dispose: () => void;
}

/** Equal-power pair for crossfader position x ∈ [0,1]. */
function xfGains(x: number): { a: number; b: number } {
  const clamped = Math.max(0, Math.min(1, x));
  return {
    a: Math.cos((clamped * Math.PI) / 2),
    b: Math.sin((clamped * Math.PI) / 2),
  };
}

function createDeck(xfGain: Tone.Gain, master: Tone.Gain): DjDeck {
  const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
  const filter = new Tone.Filter({ type: "lowpass", frequency: 20000, Q: 0.9 });
  const fader = new Tone.Gain(1);
  const analyser = new Tone.Analyser("waveform", 512);

  eq.connect(filter);
  filter.connect(fader);
  fader.connect(xfGain);
  xfGain.connect(analyser);
  analyser.connect(master);

  let player: Tone.Player | null = null;
  let meta: DeckMeta | null = null;
  let durationSec = 0;

  // Playhead anchor: position when (re)anchored + the ctx time of the anchor.
  let posAtAnchor = 0;
  let anchorCtx = 0;
  let playing = false;
  let rate = 1;
  let loop = false;
  let cueSec = 0;
  let filterKnob = 0;
  let volume = 1;
  const eqState: Record<EqBand, number> = { low: 0, mid: 0, high: 0 };
  // player.onstop fires for BOTH manual stops and natural track end — this
  // flag tells the handler which one it is.
  let stopExpected = false;

  const now = () => Tone.getContext().currentTime;

  const position = (): number => {
    let p = playing ? posAtAnchor + (now() - anchorCtx) * rate : posAtAnchor;
    if (loop && durationSec > 0) p = ((p % durationSec) + durationSec) % durationSec;
    return Math.max(0, Math.min(p, durationSec));
  };

  const anchor = (pos: number) => {
    posAtAnchor = pos;
    anchorCtx = now();
  };

  const stopPlayer = () => {
    if (!player) return;
    stopExpected = true;
    try { player.stop(); } catch { /* not started */ }
  };

  const startAt = (sec: number) => {
    if (!player || durationSec === 0) return;
    const from = Math.max(0, Math.min(sec, Math.max(0, durationSec - 0.01)));
    stopPlayer();
    player.start(undefined, from);
    anchor(from);
    playing = true;
  };

  const deck: DjDeck = {
    analyser,

    load(buffer, m) {
      stopPlayer();
      player?.dispose();
      const tb = new Tone.ToneAudioBuffer();
      tb.set(buffer);
      player = new Tone.Player(tb);
      player.loop = loop;
      player.playbackRate = rate;
      player.connect(eq);
      player.onstop = () => {
        if (stopExpected) {
          stopExpected = false;
          return;
        }
        // Natural end (non-loop): park the playhead at the end.
        playing = false;
        anchor(durationSec);
      };
      meta = m;
      durationSec = buffer.duration;
      cueSec = 0;
      anchor(0);
      playing = false;
    },

    play(fromSec) {
      startAt(fromSec ?? position());
    },

    pause() {
      if (!playing) return;
      const p = position();
      playing = false;
      stopPlayer();
      anchor(p);
    },

    toggle() {
      if (playing) deck.pause();
      else deck.play();
    },

    seek(sec) {
      if (playing) startAt(sec);
      else anchor(Math.max(0, Math.min(sec, durationSec)));
    },

    setCue(sec) {
      cueSec = Math.max(0, Math.min(sec ?? position(), durationSec));
    },

    jumpCue() {
      deck.seek(cueSec);
    },

    setRate(r) {
      const p = position();
      rate = r;
      if (player) player.playbackRate = r;
      anchor(p); // re-anchor so the playhead math uses the new rate from here
    },

    setLoop(on) {
      loop = on;
      if (player) player.loop = on;
    },

    setEq(band, db) {
      eqState[band] = db;
      eq[band].rampTo(db, RAMP_SEC);
    },

    setFilter(v) {
      filterKnob = Math.max(-1, Math.min(1, v));
      if (Math.abs(filterKnob) < 0.03) {
        filter.type = "lowpass";
        filter.frequency.rampTo(20000, RAMP_SEC);
      } else if (filterKnob < 0) {
        // Left of center: lowpass closes 20 kHz → 200 Hz (exponential).
        filter.type = "lowpass";
        filter.frequency.rampTo(200 * Math.pow(100, 1 + filterKnob), RAMP_SEC);
      } else {
        // Right of center: highpass closes 20 Hz → 2 kHz.
        filter.type = "highpass";
        filter.frequency.rampTo(20 * Math.pow(100, filterKnob), RAMP_SEC);
      }
    },

    setVolume(v) {
      volume = Math.max(0, v);
      fader.gain.rampTo(volume, RAMP_SEC);
    },

    getState() {
      return {
        loaded: player !== null,
        title: meta?.title ?? null,
        bpm: meta?.bpm ?? null,
        durationSec,
        playing,
        positionSec: position(),
        rate,
        loop,
        cueSec,
        eq: { ...eqState },
        filter: filterKnob,
        volume,
      };
    },
  };

  return Object.assign(deck, {
    // Internal disposer reached via createDjEngine's closure.
    __dispose: () => {
      stopPlayer();
      player?.dispose();
      eq.dispose();
      filter.dispose();
      fader.dispose();
      analyser.dispose();
    },
  });
}

export function createDjEngine(): DjEngine {
  const master = new Tone.Gain(1);
  const masterAnalyser = new Tone.Analyser("waveform", 512);
  master.connect(masterAnalyser);
  masterAnalyser.toDestination();

  let crossfade = 0.5;
  const initial = xfGains(crossfade);
  const xfA = new Tone.Gain(initial.a);
  const xfB = new Tone.Gain(initial.b);

  const deckA = createDeck(xfA, master);
  const deckB = createDeck(xfB, master);

  return {
    decks: { a: deckA, b: deckB },

    setCrossfade(x, rampSec = 0.06) {
      crossfade = Math.max(0, Math.min(1, x));
      const g = xfGains(crossfade);
      xfA.gain.rampTo(g.a, rampSec);
      xfB.gain.rampTo(g.b, rampSec);
    },

    getCrossfade: () => crossfade,

    setMasterVolume(v) {
      master.gain.rampTo(Math.max(0, v), RAMP_SEC);
    },

    masterAnalyser,

    dispose() {
      (deckA as unknown as { __dispose: () => void }).__dispose();
      (deckB as unknown as { __dispose: () => void }).__dispose();
      xfA.dispose();
      xfB.dispose();
      master.dispose();
      masterAnalyser.dispose();
    },
  };
}
