"use client";

import dynamic from "next/dynamic";
import { Mic } from "lucide-react";
import type { KaraokeSongRow } from "@/lib/db/queries/karaoke";

// Tone.js is browser-only — load dynamically with no SSR
const ToneMidiPlayer = dynamic(() => import("./tone-midi-player"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border bg-card p-4 flex items-center justify-center h-28">
      <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

interface Props {
  song: KaraokeSongRow;
  onTimeUpdate: (time: number) => void;
  onBpmChange: (bpm: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function KaraokePlayer({ song, onTimeUpdate, onBpmChange, onPlayingChange }: Props) {
  // MIDI playback (preferred)
  if (song.midi_blob_url) {
    return (
      <ToneMidiPlayer
        midiBlobUrl={song.midi_blob_url}
        duration={song.duration_sec ?? 0}
        onTimeUpdate={onTimeUpdate}
        onBpmChange={onBpmChange}
        onStateChange={onPlayingChange}
      />
    );
  }

  // WAV playback (if available)
  if (song.wav_blob_url) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <audio
          controls
          src={song.wav_blob_url}
          className="w-full"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onPlay={() => onPlayingChange(true)}
          onPause={() => onPlayingChange(false)}
        />
        <p className="text-[10px] text-muted-foreground text-center">
          WAV mode — lyrics sync available
        </p>
      </div>
    );
  }

  // No source — waiting on Pi batch upload
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center space-y-3">
      <Mic className="mx-auto size-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">Playback coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          Run <code className="bg-muted px-1 rounded text-[10px]">python pi/scripts/upload_karaoke_midi.py</code> on your Pi
          to upload the MIDI files. Lyrics are available in the meantime.
        </p>
      </div>
    </div>
  );
}
