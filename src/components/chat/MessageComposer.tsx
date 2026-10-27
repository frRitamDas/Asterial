"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CornerUpLeft,
  FileText,
  ImagePlus,
  Loader2,
  Paperclip,
  RotateCcw,
  SendHorizontal,
  Smile,
  X,
} from "lucide-react";
import { EMOJI_CATEGORIES } from "@/lib/constants/brand";
import { formatBytes } from "@/lib/utils/format";
import { validateUploadFile } from "@/lib/validation/schemas";
import { uploadConversationAttachment } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils/cn";

export interface StagedAttachment {
  localId: string;
  file: File;
  previewUrl: string | null;
  status: "ready" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
  uploadedMeta?: {
    storagePath: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
  };
}

interface ReplyContext {
  id: string;
  senderDisplayName: string;
  body: string;
  hasAttachments: boolean;
}

interface MessageComposerProps {
  conversationId: string;
  userId: string;
  disabled?: boolean;
  disabledReason?: string;
  replyTo: ReplyContext | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onSendMessage: (params: {
    body: string;
    replyToId: string | null;
    attachments: Array<{
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
    }>;
  }) => Promise<void>;
}

export function MessageComposer({
  conversationId,
  userId,
  disabled = false,
  disabledReason,
  replyTo,
  onCancelReply,
  onTyping,
  onSendMessage,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Abort any in-flight uploads on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      for (const ctrl of controllers.values()) {
        ctrl.abort();
      }
      controllers.clear();
    };
  }, []);

  // Auto-grow textarea height smoothly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const startUploadForItem = async (item: StagedAttachment) => {
    const controller = new AbortController();
    abortControllersRef.current.set(item.localId, controller);

    setStaged((prev) =>
      prev.map((s) =>
        s.localId === item.localId
          ? { ...s, status: "uploading", progress: 4, error: undefined }
          : s
      )
    );

    try {
      const uploadedMeta = await uploadConversationAttachment({
        conversationId,
        userId,
        file: item.file,
        signal: controller.signal,
        onProgress: (pct) => {
          setStaged((prev) =>
            prev.map((s) =>
              s.localId === item.localId ? { ...s, progress: pct } : s
            )
          );
        },
      });

      setStaged((prev) =>
        prev.map((s) =>
          s.localId === item.localId
            ? { ...s, status: "uploaded", progress: 100, uploadedMeta }
            : s
        )
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Removed by user cancellation
        return;
      }
      const msg = err instanceof Error ? err.message : "Upload failed";
      setStaged((prev) =>
        prev.map((s) =>
          s.localId === item.localId
            ? { ...s, status: "error", error: msg }
            : s
        )
      );
    } finally {
      abortControllersRef.current.delete(item.localId);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setComposerError(null);

    const incoming = Array.from(files);
    if (staged.length + incoming.length > 5) {
      setComposerError("You can attach up to 5 files per message.");
      return;
    }

    for (const file of incoming) {
      const validation = await validateUploadFile(file, "attachment");
      if (!validation.ok) {
        setComposerError(`${file.name}: ${validation.error}`);
        continue;
      }

      const localId = crypto.randomUUID();
      const previewUrl = validation.verifiedMime.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;

      const stagedItem: StagedAttachment = {
        localId,
        file,
        previewUrl,
        status: "uploading",
        progress: 0,
      };

      setStaged((prev) => [...prev, stagedItem]);
      void startUploadForItem(stagedItem);
    }
  };

  const removeStagedItem = (localId: string) => {
    const controller = abortControllersRef.current.get(localId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(localId);
    }
    setStaged((prev) => {
      const target = prev.find((i) => i.localId === localId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((i) => i.localId !== localId);
    });
  };

  const anyUploading = staged.some((s) => s.status === "uploading");
  const anyErrored = staged.some((s) => s.status === "error");
  const uploadedAttachments = staged
    .filter((s) => s.status === "uploaded" && s.uploadedMeta)
    .map((s) => s.uploadedMeta!);

  const canSend =
    !disabled &&
    !sending &&
    !anyUploading &&
    !anyErrored &&
    (text.trim().length > 0 || uploadedAttachments.length > 0);

  const triggerSend = async () => {
    if (!canSend) return;
    setComposerError(null);

    const bodyToSend = text.trim();
    if (bodyToSend.length > 4000) {
      setComposerError("Message cannot exceed 4,000 characters.");
      return;
    }

    const attachmentsToSend = [...uploadedAttachments];
    const replyIdToSend = replyTo?.id || null;

    setSending(true);
    setText("");
    setEmojiOpen(false);
    setStaged((prev) => {
      for (const s of prev) {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      }
      return [];
    });
    onCancelReply();

    try {
      await onSendMessage({
        body: bodyToSend,
        replyToId: replyIdToSend,
        attachments: attachmentsToSend,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // On desktop viewports, Enter sends and Shift+Enter inserts newline
      const isCoarsePointer =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;
      if (!isCoarsePointer) {
        e.preventDefault();
        void triggerSend();
      }
    }
  };

  if (disabled) {
    return (
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-void)] px-4 py-3.5 text-center text-xs text-zinc-500">
        {disabledReason || "You cannot send messages in this conversation."}
      </div>
    );
  }

  return (
    <div className="relative border-t border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 pt-3 pb-3 pb-safe sm:px-5">
      {/* Error Banner */}
      {composerError && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{composerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setComposerError(null)}
            aria-label="Dismiss error"
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-[var(--bg-surface)] px-3 py-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white">
                Replying to {replyTo.senderDisplayName}
              </p>
              <p className="truncate text-xs text-zinc-400">
                {replyTo.body ||
                  (replyTo.hasAttachments ? "Attachment" : "Message")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Staged Attachments Tray */}
      {staged.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {staged.map((item) => (
            <div
              key={item.localId}
              className="relative flex w-56 items-center gap-2.5 rounded-xl border border-white/12 bg-[var(--bg-surface)] p-2"
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <FileText className="h-4 w-4 text-zinc-300" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {item.file.name}
                </p>
                {item.status === "uploading" ? (
                  <div className="mt-1 space-y-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-white transition-all duration-150"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="font-mono text-[10px] text-zinc-400">
                      Uploading {item.progress}%
                    </p>
                  </div>
                ) : item.status === "error" ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-[10px] text-red-400">
                      {item.error || "Failed"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void startUploadForItem(item)}
                      title="Retry upload"
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-white underline cursor-pointer"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Retry
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-[10px] text-zinc-500">
                    {formatBytes(item.file.size)} · Ready
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeStagedItem(item.localId)}
                title={
                  item.status === "uploading"
                    ? "Cancel upload"
                    : "Remove attachment"
                }
                aria-label={
                  item.status === "uploading"
                    ? "Cancel upload"
                    : "Remove attachment"
                }
                className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Emoji Picker Popover */}
      {emojiOpen && (
        <div className="absolute bottom-18 left-3 sm:left-5 z-30 w-72 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 shadow-2xl animate-asterial-in">
          <div className="flex items-center justify-between gap-1 border-b border-white/[0.08] pb-2 mb-2">
            <div className="flex items-center gap-1">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setEmojiTab(idx)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    emojiTab === idx
                      ? "bg-white text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEmojiOpen(false)}
              aria-label="Close emoji picker"
              className="rounded-md p-1 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_CATEGORIES[emojiTab]?.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setText((prev) => `${prev}${emoji}`);
                  textareaRef.current?.focus();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Bar */}
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 focus-within:border-[var(--border-active)] transition-colors">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.json,.zip"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex items-center gap-0.5 pb-0.5">
          <button
            type="button"
            onClick={() => setEmojiOpen((prev) => !prev)}
            title="Insert emoji"
            aria-label="Insert emoji"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer",
              emojiOpen
                ? "bg-white text-zinc-950"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Attach image"
            aria-label="Attach image"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            aria-label="Attach file"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim().length > 0) {
              onTyping();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          aria-label="Message input"
          maxLength={4000}
          className="max-h-40 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--text-primary)] placeholder:text-zinc-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void triggerSend()}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer",
            canSend
              ? "bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95"
              : "bg-white/[0.06] text-zinc-600 pointer-events-none"
          )}
        >
          {sending || anyUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
