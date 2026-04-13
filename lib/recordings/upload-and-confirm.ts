export interface UploadAndConfirmInput {
  blob: Blob;
  contentType: string;
  fileName: string;
  title: string;
  peaks: number[];
  durationSec: number;
  onProgress?: (pct: number) => void;
}

export interface UploadedRecording {
  id: string;
  title: string;
}

export async function uploadAndConfirmRecording({
  blob,
  contentType,
  fileName,
  title,
  peaks,
  durationSec,
  onProgress,
}: UploadAndConfirmInput): Promise<UploadedRecording> {
  onProgress?.(5);

  const uploadRes = await fetch("/api/recordings/upload", {
    method: "POST",
    headers: {
      "Content-Type": contentType || "audio/wav",
      "x-file-name": fileName,
    },
    body: blob,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload failed (${uploadRes.status})`);
  }
  const { blobUrl } = (await uploadRes.json()) as { blobUrl: string };
  onProgress?.(75);

  const confirmRes = await fetch("/api/recordings/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobUrl,
      metadata: {
        title,
        duration_sec: durationSec,
        waveform_peaks: peaks,
      },
    }),
  });
  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Confirm failed (${confirmRes.status})`);
  }
  const { recording } = (await confirmRes.json()) as {
    recording: { id: string; title: string | null };
  };
  onProgress?.(100);
  return { id: recording.id, title: recording.title ?? title };
}
