"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { UploadModal } from "./upload-modal";

export function UploadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleUploaded() {
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Upload className="size-4" />
        Upload
      </button>

      {open && (
        <UploadModal
          onClose={() => setOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </>
  );
}
