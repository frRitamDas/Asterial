"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

export default function SettingsNotificationsPage() {
  const { preferences, conversations, updatePreferences, toggleMute } =
    useWorkspace();
  const { pushToast } = useToast();

  const [browserPermission, setBrowserPermission] = useState<string>(() =>
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported"
  );

  const mutedConversations = conversations.filter(
    (c) => c.membership.is_muted && !c.membership.left_at
  );

  const handleToggleBrowserNotifications = async (next: boolean) => {
    if (!next) {
      await updatePreferences({ browser_enabled: false });
      return;
    }

    if (typeof Notification === "undefined") {
      pushToast({
        title: "Browser notifications unsupported",
        description: "This browser does not support the Notification API.",
        variant: "error",
      });
      return;
    }

    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
    if (perm === "granted") {
      await updatePreferences({ browser_enabled: true });
      pushToast({
        title: "Desktop notifications enabled",
        variant: "success",
      });
    } else {
      pushToast({
        title: "Permission not granted",
        description: "Allow notifications in your browser site settings.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Notifications" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Notifications
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Control global alerts, browser permission state, direct vs group
              delivery, sound, and muted threads.
            </p>
          </div>

          {/* Browser Permission Status */}
          <section className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Browser Notification Permission
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Actual permission reported by this browser session.
                </p>
              </div>
              <Badge
                variant={
                  browserPermission === "granted"
                    ? "accent"
                    : browserPermission === "denied"
                      ? "danger"
                      : "neutral"
                }
              >
                {browserPermission === "granted"
                  ? "Granted"
                  : browserPermission === "denied"
                    ? "Blocked in browser"
                    : browserPermission === "default"
                      ? "Not yet requested"
                      : "Unsupported"}
              </Badge>
            </div>

            <Switch
              id="notif-browser-enabled"
              checked={
                Boolean(preferences?.browser_enabled) &&
                browserPermission === "granted"
              }
              onCheckedChange={(next) =>
                void handleToggleBrowserNotifications(next)
              }
              label="Desktop notifications"
              description="Show native OS notifications when new messages arrive while ASTERIAL is in the background."
            />
          </section>

          {/* Delivery & Sound Controls */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <Switch
              id="notif-global"
              checked={preferences?.in_app_enabled !== false}
              onCheckedChange={(next) =>
                void updatePreferences({ in_app_enabled: next })
              }
              label="Enable all notifications"
              description="Master toggle for in-app alerts, sounds, and desktop notifications."
            />

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="notif-dm"
                checked={preferences?.dm_notifications !== false}
                disabled={preferences?.in_app_enabled === false}
                onCheckedChange={(next) =>
                  void updatePreferences({ dm_notifications: next })
                }
                label="Direct messages"
                description="Notify when someone messages you in a 1:1 thread."
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="notif-groups"
                checked={preferences?.group_notifications !== false}
                disabled={preferences?.in_app_enabled === false}
                onCheckedChange={(next) =>
                  void updatePreferences({ group_notifications: next })
                }
                label="Group messages"
                description="Notify when messages arrive in multi-member groups."
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="notif-sound"
                checked={preferences?.sound_enabled !== false}
                disabled={preferences?.in_app_enabled === false}
                onCheckedChange={(next) =>
                  void updatePreferences({ sound_enabled: next })
                }
                label="Notification sound"
                description="Play a subtle chime for incoming messages when not viewing that conversation."
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="notif-preview"
                checked={preferences?.message_preview !== false}
                disabled={preferences?.in_app_enabled === false}
                onCheckedChange={(next) =>
                  void updatePreferences({ message_preview: next })
                }
                label="Show message content in notifications"
                description="Include sender message text in notification banners and conversation previews."
              />
            </div>
          </section>

          {/* Muted Conversations List */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Muted Conversations ({mutedConversations.length})
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Muted threads never play chimes or trigger desktop alerts.
              </p>
            </div>

            {mutedConversations.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 text-xs text-[var(--text-muted)]">
                <BellOff className="h-4 w-4 shrink-0" />
                <span>You have no muted conversations.</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                {mutedConversations.map((c) => (
                  <div
                    key={c.conversation.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <Link
                      href={`/app/chats/${c.conversation.id}`}
                      className="flex items-center gap-2.5 min-w-0"
                    >
                      <Avatar
                        name={c.displayTitle}
                        avatarPath={c.displayAvatarPath}
                        size="sm"
                        isGroup={c.conversation.type === "group"}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {c.displayTitle}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-secondary)]">
                          {c.displaySubtitle}
                        </p>
                      </div>
                    </Link>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void toggleMute(c.conversation.id, false)}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>Unmute</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
