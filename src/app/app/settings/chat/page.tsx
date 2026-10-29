"use client";

import React from "react";
import { Check } from "lucide-react";
import { CHAT_WALLPAPER_OPTIONS } from "@asterial/core";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils/cn";
import type { ChatWallpaper, MediaAutoDownload } from "@/lib/types/database";

export default function SettingsChatPage() {
  const { preferences, updatePreferences } = useWorkspace();

  const enterToSend = preferences?.enter_to_send !== false;
  const previewEnabled = preferences?.message_preview !== false;
  const showLinkPreviews = preferences?.show_link_previews !== false;
  const keepChatsArchived = preferences?.keep_chats_archived !== false;
  const currentWallpaper: ChatWallpaper =
    preferences?.chat_wallpaper || "constellation";
  const autoDownload: MediaAutoDownload =
    preferences?.media_auto_download || "always";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Chat" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Chat Preferences
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Configure composer shortcuts, message previews, media loading, and
              archive behavior.
            </p>
          </div>

          {/* Composer & Previews */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <Switch
              id="chat-enter-to-send"
              checked={enterToSend}
              onCheckedChange={(next) =>
                void updatePreferences({ enter_to_send: next })
              }
              label="Press Enter to send"
              description="Send messages with Enter and insert new lines with Shift + Enter. When off, use Ctrl/⌘ + Enter or the Send button."
            />

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="chat-message-previews"
                checked={previewEnabled}
                onCheckedChange={(next) =>
                  void updatePreferences({ message_preview: next })
                }
                label="Show message previews"
                description="Display the latest message snippet in your Chats list and desktop alerts."
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="chat-link-previews"
                checked={showLinkPreviews}
                onCheckedChange={(next) =>
                  void updatePreferences({ show_link_previews: next })
                }
                label="Inline link cards"
                description="Show clean domain link cards beneath messages that contain URLs."
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="chat-keep-archived"
                checked={keepChatsArchived}
                onCheckedChange={(next) =>
                  void updatePreferences({ keep_chats_archived: next })
                }
                label="Keep chats archived"
                description="Archived conversations remain in Archived when new messages arrive. Turn off to return them to your main Chats list automatically."
              />
            </div>
          </section>

          {/* Media Auto-Download */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Media Auto-Download
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Choose which incoming attachments load automatically inside
                conversations.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {(
                [
                  [
                    "always",
                    "Always",
                    "Load photos, videos, and audio automatically",
                  ],
                  [
                    "images_only",
                    "Photos only",
                    "Click to load videos and voice notes",
                  ],
                  [
                    "manual",
                    "Manual",
                    "Click to load any incoming media file",
                  ],
                ] as const
              ).map(([value, title, desc]) => {
                const active = autoDownload === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      void updatePreferences({ media_auto_download: value })
                    }
                    className={cn(
                      "flex flex-col items-start rounded-[12px] border p-3.5 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {title}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      )}
                    </div>
                    <span className="mt-1 text-[11px] text-[var(--text-secondary)] leading-snug">
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Chat Canvas Wallpaper */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Conversation Background
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Subtle background texture rendered behind active message
                threads.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {CHAT_WALLPAPER_OPTIONS.map((opt) => {
                const active = currentWallpaper === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      void updatePreferences({ chat_wallpaper: opt.id })
                    }
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[12px] border p-3.5 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {opt.description}
                      </p>
                    </div>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
