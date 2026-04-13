"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWav } from "@/lib/audio/decode-to-wav";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";

export type RecordStatus =
  | "idle"
  | "requesting"
  | "denied"
  | "ready"
  | "recording"
  | "stopping"
  | "captured"
  | "error";

export interface CapturedTake {
  wavBlob: Blob;
  audioBuffer: AudioBuffer;
  durationSec: number;
  peaks: number[];
}

export interface UseMicrophoneRecord {
  status: RecordStatus;
  errorMessage: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
  analyserNode: AnalyserNode | null;
  elapsedMs: number;
  warnAt5min: boolean;
  hardCapReached: boolean;
  take: CapturedTake | null;
  requestPermission: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  discard: () => void;
  reset: () => void;
}

const WARN_MS = 5 * 60 * 1000;
const HARD_CAP_MS = 10 * 60 * 1000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function mapMediaError(err: unknown): { status: RecordStatus; message: string } {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      return {
        status: "denied",
        message:
          "Microphone access is blocked. Open your browser's site settings to allow it, then try again.",
      };
    }
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return {
        status: "denied",
        message: "No microphone found. Connect an input device and try again.",
      };
    }
    return { status: "error", message: err.message || err.name };
  }
  return {
    status: "error",
    message: err instanceof Error ? err.message : "Unknown recording error",
  };
}

export function useMicrophoneRecord(): UseMicrophoneRecord {
  const [status, setStatus] = useState<RecordStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [take, setTake] = useState<CapturedTake | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const hardCapFiredRef = useRef(false);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      // ignore — devices stay as-is
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const handler = () => void refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    };
  }, [refreshDevices]);

  const teardownStream = useCallback(() => {
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      // ignore
    }
    sourceNodeRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserRef.current = null;
    setAnalyserNode(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    teardownStream();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
    hardCapFiredRef.current = false;
    setElapsedMs(0);
    setTake(null);
    setErrorMessage(null);
    setStatus("idle");
  }, [teardownStream]);

  useEffect(() => () => reset(), [reset]);

  const openStream = useCallback(
    async (deviceId: string | null): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    [],
  );

  const wireAnalyser = useCallback((stream: MediaStream) => {
    const ctx =
      audioCtxRef.current ??
      new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    sourceNodeRef.current = source;
    analyserRef.current = analyser;
    setAnalyserNode(analyser);
    return ctx;
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setStatus("denied");
      setErrorMessage("This browser does not support microphone recording.");
      return;
    }
    setStatus("requesting");
    setErrorMessage(null);
    try {
      const stream = await openStream(null);
      streamRef.current = stream;
      const ctx = wireAnalyser(stream);
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => undefined);
      }
      await refreshDevices();
      const activeTrack = stream.getAudioTracks()[0];
      const activeDeviceId = activeTrack?.getSettings().deviceId ?? null;
      setSelectedDeviceIdState(activeDeviceId);
      setStatus("ready");
    } catch (err) {
      const mapped = mapMediaError(err);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
    }
  }, [openStream, refreshDevices, wireAnalyser]);

  const setSelectedDeviceId = useCallback(
    (id: string) => {
      setSelectedDeviceIdState(id);
      if (status !== "ready" && status !== "idle" && status !== "denied") return;
      if (status !== "ready") return;
      void (async () => {
        try {
          teardownStream();
          const stream = await openStream(id);
          streamRef.current = stream;
          wireAnalyser(stream);
        } catch (err) {
          const mapped = mapMediaError(err);
          setStatus(mapped.status);
          setErrorMessage(mapped.message);
        }
      })();
    },
    [openStream, status, teardownStream, wireAnalyser],
  );

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setStatus("stopping");
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const sourceBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const type = recorder.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type });
          chunksRef.current = [];
          resolve(blob);
        } catch (e) {
          reject(e);
        }
      };
      recorder.onerror = (e) => reject(e);
      try {
        recorder.stop();
      } catch (e) {
        reject(e);
      }
    }).catch((e) => {
      const mapped = mapMediaError(e);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
      return null;
    });

    if (!sourceBlob || sourceBlob.size === 0) {
      setStatus((prev) => (prev === "error" ? prev : "error"));
      setErrorMessage((prev) => prev ?? "No audio captured.");
      return;
    }

    try {
      const ctx = audioCtxRef.current ?? undefined;
      const { wavBlob, audioBuffer, durationSec } = await blobToWav(sourceBlob, ctx);
      const peaks = computePeaksFromBuffer(audioBuffer);
      setTake({ wavBlob, audioBuffer, durationSec, peaks });
      setStatus("captured");
    } catch (err) {
      const mapped = mapMediaError(err);
      setStatus(mapped.status);
      setErrorMessage(mapped.message || "Could not decode recording.");
    }
  }, []);

  const start = useCallback(async () => {
    if (status !== "ready" || !streamRef.current) return;
    setErrorMessage(null);
    setTake(null);
    chunksRef.current = [];
    hardCapFiredRef.current = false;

    try {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      startedAtRef.current = performance.now();
      setElapsedMs(0);

      const tick = () => {
        const elapsed = performance.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= HARD_CAP_MS && !hardCapFiredRef.current) {
          hardCapFiredRef.current = true;
          void stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setStatus("recording");
    } catch (err) {
      const mapped = mapMediaError(err);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
    }
  }, [status, stop]);

  const discard = useCallback(() => {
    setTake(null);
    setElapsedMs(0);
    setErrorMessage(null);
    if (streamRef.current && streamRef.current.getAudioTracks().some((t) => t.readyState === "live")) {
      setStatus("ready");
    } else {
      setStatus("idle");
    }
  }, []);

  return {
    status,
    errorMessage,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    analyserNode,
    elapsedMs,
    warnAt5min: elapsedMs >= WARN_MS,
    hardCapReached: elapsedMs >= HARD_CAP_MS,
    take,
    requestPermission,
    start,
    stop,
    discard,
    reset,
  };
}
