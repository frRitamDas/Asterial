"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Film,
  Loader2,
  Mic,
  X,
} from "lucide-react";
import { getCachedSignedUrl, resolveSignedUrl } from "@/lib/supabase/storage";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { AttachmentRow } from "@/lib/types/database";

interface AttachmentMediaProps {
  attachment: AttachmentRow;
  isOwnMessage: boolean;
}

export function AttachmentMedia({
  attachment,
  isOwnMessage,
}: AttachmentMediaProps) {
  const mime = attachment.mime_type.toLowerCase();
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  const cachedUrl = getCachedSignedUrl(
    "chat-attachments",
    attachment.storage_path
  );
  const [asyncResolved, setAsyncResolved] = useState<{
    path: string;
    url: string | null;
  } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (cachedUrl) {
      return;
    }
    resolveSignedUrl("chat-attachments", attachment.storage_path).then((url) => {
      if (active) {
        setAsyncResolved({ path: attachment.storage_path, url });
      }
    });

    return () => {
      active = false;
    };
  }, [attachment.storage_path, cachedUrl]);

  const signedUrl =
    cachedUrl ||
    (asyncResolved?.path === attachment.storage_path
      ? asyncResolved.url
      : null);
  const loading =
    !cachedUrl && asyncResolved?.path !== attachment.storage_path;

  if (isImage) {
    return (
      <>
        <div className="mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-black/20 max-w-xs">
          {loading ? (
            <div className="flex h-44 w-60 items-center justify-center text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : signedUrl ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full cursor-zoom-in text-left"
              aria-label={`View image ${attachment.file_name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={attachment.file_name}
                className="max-h-72 w-full object-cover transition-opacity hover:opacity-95"
              />
            </button>
          ) : (
            <div className="flex h-28 w-56 items-center justify-center px-3 text-center text-xs text-zinc-500">
              Attachment unavailable
            </div>
          )}
        </div>

        {lightboxOpen && signedUrl && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={attachment.file_name}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-xs animate-asterial-in"
          >
            <div className="mb-3 flex w-full max-w-4xl items-center justify-between px-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">
                  {attachment.file_name}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  {formatBytes(attachment.byte_size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={attachment.file_name}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs text-white hover:bg-white/[0.12]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Close image preview"
                  className="rounded-lg border border-white/15 bg-white/[0.06] p-1.5 text-white hover:bg-white/[0.12] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={attachment.file_name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        )}
      </>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1.5 overflow-hidden rounded-xl border border-white/12 bg-black max-w-xs">
        {loading ? (
          <div className="flex h-44 w-64 items-center justify-center gap-2 text-xs text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading video…</span>
          </div>
        ) : signedUrl ? (
          <div>
            <video
              src={signedUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 w-full bg-black object-contain"
            />
            <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/50 px-2.5 py-1.5 text-[10px] text-zinc-300">
              <span className="flex items-center gap-1 truncate">
                <Film className="h-3 w-3 shrink-0" />
                <span className="truncate">{attachment.file_name}</span>
              </span>
              <span className="shrink-0 font-mono text-zinc-400">
                {formatBytes(attachment.byte_size)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-28 w-56 items-center justify-center px-3 text-center text-xs text-zinc-500">
            Video unavailable
          </div>
        )}
      </div>
    );
  }

  if (isAudio) {
    const isVoiceNote = attachment.file_name.toLowerCase().includes("voice");
    return (
      <div
        className={cn(
          "mt-1.5 flex w-64 sm:w-72 flex-col gap-2 rounded-xl border px-3 py-2.5",
          isOwnMessage
            ? "border-white/15 bg-black/20"
            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
        )}
      >
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-medium truncate">
            <Mic className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
            <span className="truncate">
              {isVoiceNote ? "Voice Note" : attachment.file_name}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[10px] opacity-70">
            {formatBytes(attachment.byte_size)}
          </span>
        </div>
        {loading ? (
          <div className="flex h-8 items-center gap-2 text-xs opacity-70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Loading audio…</span>
          </div>
        ) : signedUrl ? (
          <audio
            src={signedUrl}
            controls
            preload="metadata"
            className="h-9 w-full"
          />
        ) : (
          <span className="text-[11px] opacity-60">Audio unavailable</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-1.5 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 max-w-xs",
        isOwnMessage
          ? "border-white/15 bg-black/20 text-[var(--bubble-out-fg)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{attachment.file_name}</p>
          <p className="font-mono text-[10px] opacity-70">
            {formatBytes(attachment.byte_size)}
          </p>
        </div>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin opacity-60 shrink-0" />
      ) : signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={attachment.file_name}
          aria-label={`Download ${attachment.file_name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] hover:bg-white/[0.14] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
