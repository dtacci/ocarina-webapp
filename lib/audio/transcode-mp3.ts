import { execFile } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Transcode a WAV buffer to MP3 using ffmpeg.
 *
 * Uses VBR V0 by default (~245kbps average) — best quality-to-size ratio
 * for instrument samples with complex harmonics and attack transients.
 *
 * Server-only — runs in Vercel Node.js Functions, not in the browser.
 */
export async function transcodeToMp3(
  wavBuffer: ArrayBuffer | Buffer,
  options?: { cbr?: string },
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }

  const dir = await mkdtemp(join(tmpdir(), "transcode-"));
  const inputPath = join(dir, "input.wav");
  const outputPath = join(dir, "output.mp3");

  try {
    const buf = wavBuffer instanceof Buffer
      ? wavBuffer
      : Buffer.from(new Uint8Array(wavBuffer));
    await writeFile(inputPath, buf);

    const args = [
      "-i", inputPath,
      "-codec:a", "libmp3lame",
      ...(options?.cbr
        ? ["-b:a", options.cbr]  // CBR mode (e.g. "256k")
        : ["-q:a", "0"]),        // VBR V0 (~245kbps avg)
      "-y",
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      execFile(ffmpegPath!, args, { timeout: 120_000 }, (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`ffmpeg failed: ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    });

    return await readFile(outputPath);
  } finally {
    // Best-effort cleanup — don't throw if temp files are already gone
    await unlink(inputPath).catch(() => undefined);
    await unlink(outputPath).catch(() => undefined);
    // rmdir will fail if dir isn't empty, which is fine
    const { rmdir } = await import("node:fs/promises");
    await rmdir(dir).catch(() => undefined);
  }
}
