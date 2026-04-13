"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import {
  ChevronUp,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useAudioPlayerStore,
  useHasHydrated,
  useLastTrack,
  useNowPlaying,
  useQueueLength,
  useTransport,
  useVolumeState,
} from "@/lib/stores/audio-player";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { resumeTrack } from "@/app/actions/resume-track";
import { PeaksSvg } from "./peaks-svg";

export function AudioPlayerBar() {
  const hasHydrated = useHasHydrated();
  const current = useNowPlaying();
  const lastTrack = useLastTrack();

  // Avoid hydration mismatch: wait for persisted state before rendering.
  if (!hasHydrated) return null;
  if (current) return <PlayerBarShell />;
  if (lastTrack) return <ResumeChip />;
  return null;
}

function ResumeChip() {
  const lastTrack = useLastTrack();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const setState = useAudioPlayerStore.setState;

  if (!lastTrack) return null;

  function handleResume() {
    if (!lastTrack) return;
    // iOS: the initial play() must happen inside a user gesture. Since the
    // server action is async we can't await it before calling playTrack(),
    // so we fetch metadata optimistically and dispatch as soon as it returns.
    startTransition(async () => {
      try {
        const track = await resumeTrack(lastTrack.id, lastTrack.kind);
        if (!track) {
          setFailed(true);
          return;
        }
        playTrack(track);
      } catch {
        setFailed(true);
      }
    });
  }

  function handleDismiss() {
    // Drop the snapshot so the chip stops appearing.
    setState({ lastTrack: null });
  }

  return (
    <footer
      role="region"
      aria-label="Resume last played"
      className="sticky bottom-0 z-30 shrink-0 border-t border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75"
    >
      <div className="mx-auto flex h-14 w-full items-center gap-3 px-3 sm:px-4">
        <button
          onClick={handleResume}
          disabled={isPending}
          aria-label={`Resume ${lastTrack.title}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4 ml-px" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Resume
          </div>
          <div className="truncate text-sm font-medium">
            {failed ? (
              <span className="text-destructive">
                Couldn&rsquo;t load {lastTrack.title}
              </span>
            ) : (
              lastTrack.title
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label="Dismiss resume chip"
        >
          <X />
        </Button>
      </div>
    </footer>
  );
}

function PlayerBarShell() {
  const current = useNowPlaying();
  const { status, currentTime, duration } = useTransport();
  const queueLength = useQueueLength();
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggle = useAudioPlayerStore((s) => s.toggle);
  const next = useAudioPlayerStore((s) => s.next);
  const prev = useAudioPlayerStore((s) => s.prev);
  const seek = useAudioPlayerStore((s) => s.seek);
  const clear = useAudioPlayerStore((s) => s.clear);

  if (!current) return null;

  const isPlaying = status === "playing" || status === "buffering";
  const progress = duration > 0 ? currentTime / duration : 0;
  const hasQueue = queueLength > 1;

  return (
    <footer
      role="region"
      aria-label="Now playing"
      className="sticky bottom-0 z-30 shrink-0 border-t border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75"
    >
      <div className="mx-auto flex h-16 w-full items-center gap-3 px-3 sm:px-4">
        {/* Left — artwork + title */}
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-[0_0_260px]">
          <TrackArtwork track={current} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" aria-live="polite">
              {current.href ? (
                <Link
                  href={current.href}
                  className="hover:text-primary transition-colors"
                >
                  {current.title}
                </Link>
              ) : (
                current.title
              )}
            </div>
            {current.subtitle && (
              <div className="truncate text-xs text-muted-foreground">
                {current.subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Center — transport + progress */}
        <div className="hidden flex-1 flex-col items-stretch gap-1.5 sm:flex">
          <div className="flex items-center justify-center gap-1">
            {hasQueue && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={prev}
                aria-label="Previous track"
              >
                <SkipBack />
              </Button>
            )}
            <Button
              variant="default"
              size="icon"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              aria-pressed={isPlaying}
              className="rounded-full"
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            {hasQueue && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={next}
                aria-label="Next track"
              >
                <SkipForward />
              </Button>
            )}
          </div>
          <ProgressRow
            peaks={current.peaks ?? null}
            progress={progress}
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            status={status}
          />
        </div>

        {/* Right — volume + expand + close */}
        <div className="flex flex-[0_0_auto] items-center gap-1 sm:flex-[0_0_260px] sm:justify-end">
          <VolumeControl />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSheetOpen(true)}
            aria-label="Open player"
            title="Expand"
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            aria-label="Close player"
            title="Close player"
          >
            <X />
          </Button>
        </div>

        {/* Mobile-only inline play */}
        <div className="flex sm:hidden">
          <Button
            variant="default"
            size="icon"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="rounded-full"
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
        </div>
      </div>

      {/* Mobile progress strip under the row */}
      <div className="block sm:hidden">
        <MobileProgressStrip
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
        />
      </div>

      <ExpandedSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </footer>
  );
}

function TrackArtwork({ track }: { track: ReturnType<typeof useNowPlaying> }) {
  if (!track) return null;
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
      {track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.artworkUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <Music className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

function ProgressRow({
  peaks,
  progress,
  currentTime,
  duration,
  onSeek,
  status,
}: {
  peaks: number[] | null;
  progress: number;
  currentTime: number;
  duration: number;
  onSeek: (s: number) => void;
  status: string;
}) {
  const disabled = duration <= 0 || status === "loading";
  return (
    <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
      <span className="w-8 text-right">{fmtTime(currentTime)}</span>
      <div className="relative flex-1">
        <PeaksSvg peaks={peaks} height={24} bars={96} progress={progress} />
        <input
          type="range"
          min={0}
          max={Math.max(0.01, duration)}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
        />
      </div>
      <span className="w-8">{fmtTime(duration)}</span>
    </div>
  );
}

function MobileProgressStrip({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (s: number) => void;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="relative h-1 w-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-150 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
      <input
        type="range"
        min={0}
        max={Math.max(0.01, duration)}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek"
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}

function VolumeControl() {
  const { volume, muted } = useVolumeState();
  const setVolume = useAudioPlayerStore((s) => s.setVolume);
  const toggleMute = useAudioPlayerStore((s) => s.toggleMute);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
      >
        {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
      </Button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVolume(v);
          if (muted && v > 0) toggleMute();
        }}
        aria-label="Volume"
        className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary md:block"
      />
    </div>
  );
}

function ExpandedSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger aria-hidden className="hidden" />
      <SheetContent side="bottom" className="h-[85vh]">
        <ExpandedBody onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ExpandedBody({ onClose }: { onClose: () => void }) {
  const current = useNowPlaying();
  const { currentTime, duration, status } = useTransport();
  const queue = useAudioPlayerStore((s) => s.queue);
  const queueIndex = useAudioPlayerStore((s) => s.queueIndex);
  const loop = useAudioPlayerStore((s) => s.loop);
  const setLoop = useAudioPlayerStore((s) => s.setLoop);
  const toggle = useAudioPlayerStore((s) => s.toggle);
  const next = useAudioPlayerStore((s) => s.next);
  const prev = useAudioPlayerStore((s) => s.prev);
  const seek = useAudioPlayerStore((s) => s.seek);
  const playList = useAudioPlayerStore((s) => s.playList);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => seek(Number(e.target.value)),
    [seek],
  );

  if (!current) return null;

  const isPlaying = status === "playing" || status === "buffering";
  const progress = duration > 0 ? currentTime / duration : 0;
  const upcoming = queue.slice(queueIndex + 1, queueIndex + 6);

  return (
    <div className="flex h-full flex-col gap-5 p-6 pt-10">
      <SheetHeader className="p-0">
        <SheetTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Now playing
        </SheetTitle>
      </SheetHeader>

      <div className="flex flex-col items-center gap-4">
        <div className="flex size-48 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          {current.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.artworkUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <PeaksSvg
              peaks={current.peaks ?? null}
              height={80}
              bars={64}
              progress={progress}
              className="w-40"
            />
          )}
        </div>

        <div className="text-center">
          <div className="font-heading text-lg font-medium">
            {current.title}
          </div>
          {current.subtitle && (
            <div className="text-sm text-muted-foreground">
              {current.subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={Math.max(0.01, duration)}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          aria-label="Seek"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={prev}
          aria-label="Previous track"
        >
          <SkipBack />
        </Button>
        <Button
          variant="default"
          size="icon-lg"
          onClick={toggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="size-12 rounded-full"
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={next}
          aria-label="Next track"
        >
          <SkipForward />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={loop ? "default" : "outline"}
          size="sm"
          onClick={() => setLoop(!loop)}
          aria-pressed={loop}
        >
          <Repeat />
          Loop
        </Button>
        {current.href && (
          <Link
            href={current.href}
            onClick={onClose}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open detail
          </Link>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="min-h-0 flex-1 space-y-1 overflow-auto">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Up next
          </div>
          <ul className="space-y-1">
            {upcoming.map((t, i) => (
              <li key={t.id}>
                <button
                  onClick={() => playList(queue, queueIndex + 1 + i)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Music className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
