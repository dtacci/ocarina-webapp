"use client";

/**
 * Workbench Overlay — thin wrapper around the native <dialog> element.
 *
 * Native <dialog> gives us focus-trap, ESC-to-close, and backdrop-click handling
 * for free. We just skin it: sharp corners, hairline border, ink-800 panel,
 * no fancy animations.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface OverlayHandle {
  open: () => void;
  close: () => void;
}

export interface OverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
  /** Width of the dialog in px. Default 360. */
  width?: number;
}

export const Overlay = forwardRef<OverlayHandle, OverlayProps>(
  function Overlay({ children, onClose, width = 360 }, ref) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));

    useEffect(() => {
      const d = dialogRef.current;
      if (!d || !onClose) return;
      const handler = () => onClose();
      d.addEventListener("close", handler);
      return () => d.removeEventListener("close", handler);
    }, [onClose]);

    return (
      <dialog
        ref={dialogRef}
        className="p-0 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] text-[color:var(--ink-200)] backdrop:bg-black/60"
        style={{ width }}
        onClick={(e) => {
          // Click outside the inner panel (i.e. on backdrop) closes.
          const rect = dialogRef.current?.getBoundingClientRect();
          if (!rect) return;
          const outside =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;
          if (outside) dialogRef.current?.close();
        }}
      >
        {children}
      </dialog>
    );
  },
);
