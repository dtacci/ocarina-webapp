/**
 * Parse a `.ocrec.jsonl` stream into a header + event array.
 *
 * Tolerant by design (doc §2.2): the device may produce truncated files (power
 * loss mid-session) or corrupted lines (SD failures). We read complete JSON
 * lines, skip and count bad ones, and never throw on a malformed body — only on
 * a missing/invalid header, which is unrecoverable.
 *
 * Pure: accepts either a decoded string or raw (optionally gzipped) bytes, so it
 * runs identically in Node and the browser.
 */

import { gunzipSync } from "fflate";
import type { OcarinaEvent, OcarinaHeader, ParsedSession } from "./types";

const KNOWN_EVENT_TYPES = new Set([
  "session_start",
  "session_end",
  "note_on",
  "note_off",
  "pitch_bend",
  "kit_change",
  "config_change",
  "marker",
]);

/** gzip magic bytes: 0x1f 0x8b. */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function toText(input: string | Uint8Array): string {
  if (typeof input === "string") return input;
  const bytes = isGzip(input) ? gunzipSync(input) : input;
  return new TextDecoder().decode(bytes);
}

function isHeader(obj: unknown): obj is OcarinaHeader {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as { type?: unknown }).type === "header"
  );
}

export class HeaderError extends Error {}

export function parseOcrec(input: string | Uint8Array): ParsedSession {
  const text = toText(input);
  // Split on newlines; tolerate \r\n and trailing/blank lines.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new HeaderError("Empty .ocrec file: no header line.");
  }

  let header: OcarinaHeader | null = null;
  const events: OcarinaEvent[] = [];
  let badLineCount = 0;
  let sawSessionEnd = false;

  for (let i = 0; i < lines.length; i++) {
    let obj: unknown;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      // The final line may be a partial JSON object from a truncated write;
      // every other bad line is a corruption. Either way: skip and count.
      badLineCount++;
      continue;
    }

    if (i === 0 || (header === null && isHeader(obj))) {
      if (isHeader(obj)) {
        header = obj;
        continue;
      }
      // First line wasn't a header — keep scanning for one rather than failing
      // outright, but the file is malformed.
    }

    const type = (obj as { type?: unknown }).type;
    if (typeof type !== "string" || !KNOWN_EVENT_TYPES.has(type)) {
      // Unknown event types are tolerated for forward-compat, but a non-string
      // type is garbage.
      if (typeof type === "string") {
        // forward-compatible unknown event: keep it, parsers may ignore later.
        events.push(obj as OcarinaEvent);
      } else {
        badLineCount++;
      }
      continue;
    }

    if (type === "session_end") sawSessionEnd = true;
    events.push(obj as OcarinaEvent);
  }

  if (!header) {
    throw new HeaderError("No valid header line found in .ocrec file.");
  }

  return {
    header,
    events,
    badLineCount,
    truncated: !sawSessionEnd,
  };
}
