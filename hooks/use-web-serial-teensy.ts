"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import {
  parseTeensyLine,
  LineSplitter,
} from "@/lib/serial/teensy-protocol";

export type WebSerialStatus =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export interface UseWebSerialTeensyOptions {
  baudRate?: number;
  onHardware?: (ev: HardwareEvent) => void;
  onTelemetry?: (ev: TelemetryEvent) => void;
  /** When false, the hook is fully inert — no auto-reopen, connect() is a no-op. */
  enabled?: boolean;
}

export interface UseWebSerialTeensy {
  status: WebSerialStatus;
  errorMessage: string | null;
  isSupported: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendSimKey: (byte: string, event: "down" | "up" | "tap") => Promise<void>;
}

/** PJRC VID — all Teensy boards. */
const TEENSY_VID = 0x16c0;

interface SerialPortLike {
  open: (init: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

interface SerialLike {
  requestPort: (init?: {
    filters?: { usbVendorId?: number; usbProductId?: number }[];
  }) => Promise<SerialPortLike>;
  getPorts: () => Promise<SerialPortLike[]>;
  addEventListener: (type: string, listener: (ev: Event) => void) => void;
  removeEventListener: (type: string, listener: (ev: Event) => void) => void;
}

function getSerial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const s = (navigator as unknown as { serial?: SerialLike }).serial;
  return s ?? null;
}

/**
 * Direct USB-serial driver for the Teensy. Reads the line stream, parses each
 * line with parseTeensyLine, and forwards typed events to the caller. Writes
 * single ASCII bytes for sim-key (the same byte protocol the Pi uses today).
 */
export function useWebSerialTeensy(
  options: UseWebSerialTeensyOptions = {}
): UseWebSerialTeensy {
  const { baudRate = 115200, onHardware, onTelemetry, enabled = true } = options;

  const onHwRef = useRef(onHardware);
  const onTelRef = useRef(onTelemetry);
  useEffect(() => { onHwRef.current = onHardware; }, [onHardware]);
  useEffect(() => { onTelRef.current = onTelemetry; }, [onTelemetry]);

  const serial = getSerial();
  const isSupported = serial !== null;

  const [status, setStatus] = useState<WebSerialStatus>(
    isSupported ? "idle" : "unsupported"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readLoopActiveRef = useRef(false);
  const splitterRef = useRef(new LineSplitter());

  const stopReader = useCallback(async () => {
    readLoopActiveRef.current = false;
    const reader = readerRef.current;
    readerRef.current = null;
    if (reader) {
      try { await reader.cancel(); } catch { /* swallow — closing anyway */ }
      try { reader.releaseLock(); } catch { /* idem */ }
    }
    const writer = writerRef.current;
    writerRef.current = null;
    if (writer) {
      try { await writer.close(); } catch { /* idem */ }
      try { writer.releaseLock(); } catch { /* idem */ }
    }
  }, []);

  const disconnect = useCallback(async () => {
    await stopReader();
    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try { await port.close(); } catch { /* idem */ }
    }
    splitterRef.current.reset();
    setStatus("idle");
    setErrorMessage(null);
  }, [stopReader]);

  const startReadLoop = useCallback(async (port: SerialPortLike) => {
    if (!port.readable) throw new Error("Port has no readable stream");

    // TextDecoderStream.writable is typed as WritableStream<BufferSource>,
    // which DOM lib types don't consider assignable from
    // ReadableStream<Uint8Array>. The runtime contract is the same — cast.
    const decoder = new TextDecoderStream() as unknown as ReadableWritablePair<
      string,
      Uint8Array
    >;
    const textStream = port.readable.pipeThrough(decoder);
    const reader = textStream.getReader();
    readerRef.current = reader;
    readLoopActiveRef.current = true;
    splitterRef.current.reset();

    try {
      while (readLoopActiveRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        const lines = splitterRef.current.push(value);
        for (const line of lines) {
          const parsed = parseTeensyLine(line);
          if (!parsed) continue;
          if (parsed.kind === "hw") onHwRef.current?.(parsed.event);
          else onTelRef.current?.(parsed.event);
        }
      }
    } catch (err) {
      if (readLoopActiveRef.current) {
        setErrorMessage(err instanceof Error ? err.message : "Read failed");
        setStatus("error");
      }
    } finally {
      readLoopActiveRef.current = false;
    }
  }, []);

  const openPort = useCallback(
    async (port: SerialPortLike) => {
      setStatus("connecting");
      setErrorMessage(null);
      try {
        await port.open({ baudRate });
        portRef.current = port;
        if (port.writable) {
          writerRef.current = port.writable.getWriter();
        }
        setStatus("connected");
        // Fire-and-forget the read loop; errors update status from inside.
        void startReadLoop(port);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to open port");
        setStatus("error");
        portRef.current = null;
      }
    },
    [baudRate, startReadLoop]
  );

  const connect = useCallback(async () => {
    if (!serial || !enabled) return;
    try {
      const port = await serial.requestPort({
        filters: [{ usbVendorId: TEENSY_VID }],
      });
      await openPort(port);
    } catch (err) {
      // requestPort throws NotFoundError if user cancels the picker — treat as
      // a non-error "still idle".
      if (err instanceof DOMException && err.name === "NotFoundError") {
        setStatus("idle");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Connection cancelled");
      setStatus("error");
    }
  }, [serial, openPort]);

  // Auto-reopen a previously-granted Teensy on mount.
  useEffect(() => {
    if (!serial || !enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const ports = await serial.getPorts();
        const teensy = ports.find(
          (p) => p.getInfo?.().usbVendorId === TEENSY_VID
        );
        if (teensy && !cancelled && !portRef.current) {
          await openPort(teensy);
        }
      } catch {
        // ignore — user can still click Connect
      }
    })();
    return () => { cancelled = true; };
  }, [serial, openPort, enabled]);

  // Hot-unplug: when the OS reports a disconnect for our port, tear down.
  useEffect(() => {
    if (!serial) return;
    const handleDisconnect = (ev: Event) => {
      const target = (ev as unknown as { target?: SerialPortLike }).target;
      if (target && target === portRef.current) {
        void disconnect();
      }
    };
    serial.addEventListener("disconnect", handleDisconnect);
    return () => serial.removeEventListener("disconnect", handleDisconnect);
  }, [serial, disconnect]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => { void disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendSimKey = useCallback(
    async (byte: string, event: "down" | "up" | "tap") => {
      // v8 firmware uses one-shot bytes (no separate up event); main.ino
      // would accept structured CMD lines but the existing sim-key contract
      // is byte-oriented. Skip "up" — matches Pi-side behavior for tap keys.
      if (event === "up") return;
      const writer = writerRef.current;
      if (!writer) return;
      try {
        await writer.write(new TextEncoder().encode(byte));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Write failed");
      }
    },
    []
  );

  return {
    status,
    errorMessage,
    isSupported,
    connect,
    disconnect,
    sendSimKey,
  };
}
