"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileAudio, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Stage = "idle" | "selected" | "uploading" | "confirming" | "done" | "error";

interface UploadedRecording {
  id: string;
  title: string;
}

async function computePeaks(file: File, nPoints = 200): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, 1, 44100);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = decoded.getChannelData(0);
  const chunkSize = Math.floor(channelData.length / nPoints);
  const peaks: number[] = [];
  for (let i = 0; i < nPoints; i++) {
    let sum = 0;
    const start = i * chunkSize;
    for (let j = start; j < start + chunkSize; j++) {
      sum += channelData[j] ** 2;
    }
    peaks.push(Math.sqrt(sum / chunkSize));
  }
  const max = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.round((p / max) * 10000) / 10000);
}

interface Props {
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadModal({ onClose, onUploaded }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadedRecording | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File) => {
    if (!f.type.includes("audio") && !f.name.match(/\.(wav|mp3|m4a)$/i)) {
      setError("Please select a WAV or MP3 file.");
      return;
    }
    setFile(f);
    setStage("selected");
    setError(null);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setStage("uploading");
    setProgress(0);
    setError(null);

    try {
      // 1. Compute waveform peaks in-browser
      const peaks = await computePeaks(file);
      setProgress(20);

      // 2. Upload binary to /api/recordings/upload
      const uploadRes = await fetch("/api/recordings/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "audio/wav",
          "x-file-name": file.name,
        },
        body: file,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Upload failed (${uploadRes.status})`);
      }
      const { blobUrl } = await uploadRes.json();
      setProgress(75);

      // 3. Confirm — write to DB
      setStage("confirming");
      const confirmRes = await fetch("/api/recordings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl,
          metadata: {
            title: file.name.replace(/\.[^.]+$/, ""),
            duration_sec: 0, // server will fill from actual audio if needed
            waveform_peaks: peaks,
          },
        }),
      });
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Confirm failed (${confirmRes.status})`);
      }
      const { recording } = await confirmRes.json();
      setProgress(100);
      setResult({ id: recording.id, title: recording.title ?? file.name });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    }
  }

  function handleDone() {
    onUploaded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Upload Recording</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone — shown when idle or selected */}
          {(stage === "idle" || stage === "selected" || stage === "error") && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => stage === "idle" && inputRef.current?.click()}
              className={[
                "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border",
                stage === "idle" ? "cursor-pointer hover:border-foreground/30 hover:bg-muted/30" : "",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp3,.wav,.mp3,.m4a"
                className="hidden"
                onChange={handleFileInput}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileAudio className="size-8 text-primary" />
                  <p className="text-sm font-medium truncate max-w-full">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setStage("idle"); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Drop a WAV or MP3 here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Upload progress */}
          {(stage === "uploading" || stage === "confirming") && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <Loader2 className="size-5 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {stage === "confirming" ? "Saving to library…" : "Uploading…"}
                  </p>
                  <p className="text-xs text-muted-foreground">{file?.name}</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Done */}
          {stage === "done" && result && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <div>
                <p className="font-medium">{result.title}</p>
                <p className="text-sm text-muted-foreground">Successfully added to your library</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          {stage === "done" ? (
            <button
              onClick={handleDone}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View Library
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || stage === "uploading" || stage === "confirming"}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
