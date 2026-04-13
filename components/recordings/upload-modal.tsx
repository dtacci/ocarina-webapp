"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Upload,
  X,
  FileAudio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mic,
  ExternalLink,
} from "lucide-react";
import { computePeaksFromFile } from "@/lib/audio/compute-peaks";
import {
  uploadAndConfirmRecording,
  type UploadedRecording,
} from "@/lib/recordings/upload-and-confirm";
import { RecordPanel } from "./record-panel";

type Tab = "upload" | "record";
const LAST_TAB_KEY = "ocarina:add-recording:last-tab";

interface Props {
  onClose: () => void;
  onUploaded: () => void;
  onOpenInEditor?: (recordingId: string) => void;
}

function loadSavedTab(): Tab {
  if (typeof window === "undefined") return "upload";
  const saved = window.localStorage.getItem(LAST_TAB_KEY);
  return saved === "record" || saved === "upload" ? saved : "upload";
}

export function UploadModal({ onClose, onUploaded, onOpenInEditor }: Props) {
  const [tab, setTab] = useState<Tab>(loadSavedTab);
  const [busy, setBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadedRecording | null>(null);
  const recordResetRef = useRef<(() => void) | null>(null);

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    if (next === "upload") recordResetRef.current?.();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_TAB_KEY, next);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    recordResetRef.current?.();
    onClose();
  }, [busy, onClose]);

  const handleOpenInEditor = useCallback(
    (id: string) => {
      recordResetRef.current?.();
      onUploaded();
      onOpenInEditor?.(id);
      onClose();
    },
    [onUploaded, onOpenInEditor, onClose],
  );

  const handleRecordSaved = useCallback(
    (recording: UploadedRecording) => {
      setUploadResult(recording);
    },
    [],
  );

  const handleDone = useCallback(() => {
    onUploaded();
    onClose();
  }, [onUploaded, onClose]);

  const registerRecordReset = useCallback((fn: () => void) => {
    recordResetRef.current = fn;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Add recording</h2>
          <button
            onClick={handleClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="close"
          >
            <X className="size-4" />
          </button>
        </div>

        {uploadResult ? (
          <SuccessState result={uploadResult} onDone={handleDone} />
        ) : (
          <>
            {/* Tabs */}
            <div
              className="flex gap-1 border-b px-3 pt-3"
              role="tablist"
              aria-label="add recording source"
            >
              <TabButton
                active={tab === "upload"}
                onClick={() => switchTab("upload")}
                icon={<Upload className="size-3.5" />}
                label="Upload file"
                disabled={busy}
              />
              <TabButton
                active={tab === "record"}
                onClick={() => switchTab("record")}
                icon={<Mic className="size-3.5" />}
                label="Record"
                disabled={busy}
              />
            </div>

            <div className="p-5">
              {tab === "upload" ? (
                <UploadPanel
                  onUploaded={(r) => setUploadResult(r)}
                  onBusyChange={setBusy}
                />
              ) : (
                <RecordPanel
                  onSaved={handleRecordSaved}
                  onOpenInEditor={handleOpenInEditor}
                  onBusyChange={setBusy}
                  registerReset={registerRecordReset}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {icon}
      {label}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary rounded-full"
        />
      )}
    </button>
  );
}

function SuccessState({
  result,
  onDone,
}: {
  result: UploadedRecording;
  onDone: () => void;
}) {
  return (
    <div className="p-5">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <div>
          <p className="font-medium">{result.title}</p>
          <p className="text-sm text-muted-foreground">
            Successfully added to your library
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t -mx-5 px-5 pt-4">
        <button
          onClick={onDone}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload file panel — the original file-picker flow, extracted verbatim.

type UploadStage = "idle" | "selected" | "uploading" | "confirming" | "error";

function UploadPanel({
  onUploaded,
  onBusyChange,
}: {
  onUploaded: (r: UploadedRecording) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onBusyChange(stage === "uploading" || stage === "confirming");
  }, [stage, onBusyChange]);

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
      const peaks = await computePeaksFromFile(file);
      setProgress(20);

      setStage("confirming");
      const result = await uploadAndConfirmRecording({
        blob: file,
        contentType: file.type || "audio/wav",
        fileName: file.name,
        title: file.name.replace(/\.[^.]+$/, ""),
        peaks,
        durationSec: 0,
        onProgress: setProgress,
      });
      onUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    }
  }

  const isBusy = stage === "uploading" || stage === "confirming";

  return (
    <div className="space-y-4">
      {(stage === "idle" || stage === "selected" || stage === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => stage === "idle" && inputRef.current?.click()}
          className={[
            "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
            stage === "idle"
              ? "cursor-pointer hover:border-foreground/30 hover:bg-muted/30"
              : "",
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
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setStage("idle");
                }}
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

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {isBusy && (
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

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={handleUpload}
          disabled={!file || isBusy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
          {isBusy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}
