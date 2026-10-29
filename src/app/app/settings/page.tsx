"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Download,
  ExternalLink,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ACCENT_PRESETS,
  ASTERIAL_BRAND,
  CHAT_WALLPAPER_OPTIONS,
  THEME_PALETTES,
} from "@asterial/core";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { authService, settingsService } from "@/lib/services";
import { passwordUpdateSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils/cn";
import type {
  AccentColor,
  AllowDirectMessages,
  AppearanceTheme,
  ChatWallpaper,
  PresenceVisibility,
} from "@/lib/types/database";

type SettingsSection = "appearance" | "notifications" | "privacy" | "about";

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    profile,
    preferences,
    conversations,
    blockedProfiles,
    refreshProfile,
    updatePreferences,
    toggleMute,
    unblockUser,
    signOut,
    signOutAllDevices,
  } = useWorkspace();
  const { pushToast } = useToast();

  const [section, setSection] = useState<SettingsSection>("appearance");

  const [browserPermission, setBrowserPermission] = useState<string>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Export & Delete State
  const [exportingData, setExportingData] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const mutedConversations = conversations.filter(
    (c) => c.membership.is_muted && !c.membership.left_at
  );

  const handleSavePrivacyField = async (patch: {
    presence_visibility?: PresenceVisibility;
    read_receipts_enabled?: boolean;
    allow_direct_messages?: AllowDirectMessages;
  }) => {
    if (!user) return;
    try {
      await settingsService.updatePrivacy(user.id, patch);
      await refreshProfile();
      pushToast({ title: "Privacy setting updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not update privacy setting",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

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
        title: "Browser notifications enabled",
        variant: "success",
      });
    } else {
      pushToast({
        title: "Notification permission denied",
        description: "Allow notifications in your browser site settings.",
        variant: "error",
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordUpdateSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      pushToast({
        title: "Check password",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      await authService.updatePassword(parsed.data.password);
      setNewPassword("");
      setConfirmPassword("");
      pushToast({ title: "Password updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Password update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleExportAccountData = async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const archive = await settingsService.exportMyAccountData(
        user.id,
        user.email ?? null
      );
      const blob = new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const day = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `asterial-account-export-${day}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      pushToast({
        title: "Account export downloaded",
        description: "Saved as JSON to your device.",
        variant: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not export account data",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== "DELETE") return;
    setDeletingAccount(true);
    try {
      await settingsService.deleteOwnAccount();
      pushToast({
        title: "Account permanently deleted",
        variant: "success",
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDeletingAccount(false);
      pushToast({
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const currentTheme: AppearanceTheme =
    preferences?.appearance_theme || "obsidian";
  const currentAccent: AccentColor = preferences?.accent_color || "indigo";
  const currentWallpaper: ChatWallpaper =
    preferences?.chat_wallpaper || "constellation";

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
        {/* Top Identity & Section Switcher */}
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            {profile && (
              <Avatar
                name={profile.display_name}
                avatarPath={profile.avatar_url}
                size="lg"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Settings &amp; Preferences
              </h1>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {profile
                  ? `${profile.display_name} (@${profile.username})`
                  : "Manage appearance, notifications, privacy, and security"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/profile"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <UserRound className="h-3.5 w-3.5" />
              Edit Profile
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <SegmentedControl<SettingsSection>
            ariaLabel="Settings sections"
            size="md"
            value={section}
            onChange={setSection}
            options={[
              {
                id: "appearance",
                label: "Appearance",
                icon: <Palette className="h-3.5 w-3.5" />,
              },
              {
                id: "notifications",
                label: "Notifications",
                icon: <Bell className="h-3.5 w-3.5" />,
              },
              {
                id: "privacy",
                label: "Privacy & Security",
                icon: <Shield className="h-3.5 w-3.5" />,
              },
              {
                id: "about",
                label: `About ${ASTERIAL_BRAND.version}`,
                icon: <Info className="h-3.5 w-3.5" />,
              },
            ]}
          />
        </div>

        {/* ================================================================ */}
        {/* 1. APPEARANCE                                                    */}
        {/* ================================================================ */}
        {section === "appearance" && (
          <div className="space-y-6">
            {/* Theme Mode */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Theme Surface
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Deep charcoal Obsidian is the default workspace surface.
                  System Automatic tracks your OS dark/light preference.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    "obsidian",
                    "pitch",
                    "graphite",
                    "alabaster",
                    "system",
                  ] as const
                ).map((tKey) => {
                  const p = THEME_PALETTES[tKey];
                  const active = currentTheme === tKey;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() =>
                        void updatePreferences({ appearance_theme: tKey })
                      }
                      className={cn(
                        "flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer",
                        active
                          ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/15"
                          style={{ backgroundColor: p.bgCanvas }}
                        >
                          {tKey === "system" ? (
                            <Monitor className="h-3.5 w-3.5 text-zinc-200" />
                          ) : tKey === "alabaster" ? (
                            <Sun className="h-3.5 w-3.5 text-zinc-900" />
                          ) : (
                            <Moon className="h-3.5 w-3.5 text-zinc-200" />
                          )}
                        </span>
                        {active && (
                          <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {p.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--text-muted)]">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Accent Color */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Selective Accent Color
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Used selectively for unread badges, active tabs, focus rings,
                  and outgoing message borders.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-5">
                {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((key) => {
                  const preset = ACCENT_PRESETS[key];
                  const active = currentAccent === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        void updatePreferences({ accent_color: key })
                      }
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer",
                        active
                          ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="h-5 w-5 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.hex }}
                        />
                        {active && (
                          <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {preset.label}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Chat Wallpaper & Density */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Chat Canvas &amp; Density
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Customize conversation background texture, bubble spacing, and
                  motion.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-4">
                {CHAT_WALLPAPER_OPTIONS.map((wp) => {
                  const active = currentWallpaper === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() =>
                        void updatePreferences({ chat_wallpaper: wp.id })
                      }
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors cursor-pointer",
                        active
                          ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {wp.label}
                        </span>
                        {active && (
                          <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {wp.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Message Density
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Comfortable breathing room or compact information density.
                  </p>
                </div>
                <SegmentedControl<"comfortable" | "compact">
                  ariaLabel="Message density"
                  value={preferences?.message_density || "comfortable"}
                  onChange={(d) =>
                    void updatePreferences({ message_density: d })
                  }
                  options={[
                    { id: "comfortable", label: "Comfortable" },
                    { id: "compact", label: "Compact" },
                  ]}
                />
              </div>

              <Switch
                checked={Boolean(preferences?.reduced_motion)}
                onChange={(val) =>
                  void updatePreferences({ reduced_motion: val })
                }
                label="Reduced motion"
                description="Minimize UI transitions and smooth-scroll animations."
              />
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* 2. NOTIFICATIONS                                                 */}
        {/* ================================================================ */}
        {section === "notifications" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Global Notification Channels
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Control in-app banners, sound chimes, message previews, and
                  browser alerts.
                </p>
              </div>

              <div className="space-y-3">
                <Switch
                  checked={preferences?.in_app_enabled ?? true}
                  onChange={(val) =>
                    void updatePreferences({ in_app_enabled: val })
                  }
                  label="In-app message banners"
                  description="Show toast alerts for new messages outside the active conversation."
                />
                <Switch
                  checked={preferences?.sound_enabled ?? true}
                  onChange={(val) =>
                    void updatePreferences({ sound_enabled: val })
                  }
                  label="Notification sound"
                  description="Play a subtle chime when a message arrives."
                />
                <Switch
                  checked={preferences?.message_preview ?? true}
                  onChange={(val) =>
                    void updatePreferences({ message_preview: val })
                  }
                  label="Show message text preview"
                  description="Include sender message excerpt inside notification banners."
                />
                <Switch
                  checked={preferences?.dm_notifications ?? true}
                  onChange={(val) =>
                    void updatePreferences({ dm_notifications: val })
                  }
                  label="Direct message notifications"
                  description="Receive alerts for 1-to-1 conversations."
                />
                <Switch
                  checked={preferences?.group_notifications ?? true}
                  onChange={(val) =>
                    void updatePreferences({ group_notifications: val })
                  }
                  label="Group conversation notifications"
                  description="Receive alerts for group chats."
                />
                <Switch
                  checked={Boolean(preferences?.browser_enabled)}
                  onChange={(val) => void handleToggleBrowserNotifications(val)}
                  label={`Browser push notifications (${browserPermission})`}
                  description="Alert you when ASTERIAL is in a background browser tab."
                />
              </div>
            </section>

            {/* Per-Conversation Mute Manager */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Muted Conversations ({mutedConversations.length})
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Manage per-conversation notification mutes across direct chats
                  and groups.
                </p>
              </div>

              {mutedConversations.length === 0 ? (
                <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-5 px-4 text-center text-xs text-[var(--text-muted)]">
                  No conversations are currently muted. You can mute any thread
                  from its sidebar menu or info drawer.
                </p>
              ) : (
                <div className="space-y-2">
                  {mutedConversations.map((c) => (
                    <div
                      key={c.conversation.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={c.displayTitle}
                          avatarPath={c.displayAvatarPath}
                          size="sm"
                          isGroup={c.conversation.type === "group"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {c.displayTitle}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {c.displaySubtitle}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void toggleMute(c.conversation.id, false)}
                      >
                        <BellOff className="h-3.5 w-3.5" />
                        Unmute
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* 3. PRIVACY, SECURITY & ACCOUNT                                   */}
        {/* ================================================================ */}
        {section === "privacy" && (
          <div className="space-y-6">
            {/* Presence, Read Receipts & DMs */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Visibility &amp; Messaging Controls
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Enforced server-side via PostgreSQL functions and Row Level
                  Security.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Online &amp; Last-Seen Visibility
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Choose who can see when you are online or recently active.
                  </p>
                </div>
                <SegmentedControl<PresenceVisibility>
                  ariaLabel="Presence visibility"
                  value={profile?.presence_visibility || "everyone"}
                  onChange={(v) =>
                    void handleSavePrivacyField({ presence_visibility: v })
                  }
                  options={[
                    { id: "everyone", label: "Everyone" },
                    { id: "contacts", label: "Contacts" },
                    { id: "nobody", label: "Nobody" },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Allow New Direct Messages
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Control whether people can initiate a new direct chat with
                    you.
                  </p>
                </div>
                <SegmentedControl<AllowDirectMessages>
                  ariaLabel="Allow direct messages"
                  value={profile?.allow_direct_messages || "everyone"}
                  onChange={(v) =>
                    void handleSavePrivacyField({ allow_direct_messages: v })
                  }
                  options={[
                    { id: "everyone", label: "Everyone" },
                    { id: "none", label: "Closed" },
                  ]}
                />
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-4">
                <Switch
                  checked={profile?.read_receipts_enabled ?? true}
                  onChange={(val) =>
                    void handleSavePrivacyField({ read_receipts_enabled: val })
                  }
                  label="Read receipts"
                  description="Share and view read status indicators in conversations."
                />
              </div>
            </section>

            {/* Honest Security & Transport Disclosure */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Transport, Access Control &amp; Encryption Architecture
                </h2>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {ASTERIAL_BRAND.securityNotice}
              </p>
            </section>

            {/* Active Session & Password Security */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Active Session &amp; Device Sign-Out
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Signed in as{" "}
                    <span className="font-mono text-[var(--text-primary)]">
                      {user?.email || "Authenticated user"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out this device
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void signOutAllDevices()}
                  >
                    Revoke all devices
                  </Button>
                </div>
              </div>

              <form
                onSubmit={handleChangePassword}
                className="space-y-3 border-t border-[var(--border-subtle)] pt-4"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--text-secondary)]" />
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Change Password
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="password"
                    label="New password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    label="Confirm new password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={updatingPassword}
                    disabled={!newPassword}
                  >
                    Update password
                  </Button>
                </div>
              </form>
            </section>

            {/* Blocked Users */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Blocked Accounts ({blockedProfiles.length})
              </h2>
              {blockedProfiles.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  You haven’t blocked any accounts.
                </p>
              ) : (
                <div className="space-y-2">
                  {blockedProfiles.map((bp) => (
                    <div
                      key={bp.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={bp.display_name}
                          avatarPath={bp.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {bp.display_name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                            @{bp.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void unblockUser(bp.id)}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Data Export & Account Deletion */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Export Your Data
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Download a portable JSON archive of your profile, settings,
                    Close Orbit, conversation memberships, Moments, and Feed
                    posts.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={exportingData}
                  onClick={() => void handleExportAccountData()}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export JSON
                </Button>
              </div>

              <div className="flex flex-col gap-3 border-t border-red-500/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-red-400">
                    Delete Account Permanently
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Permanently deletes your profile, memberships, private
                    Orbit, Moments, and authentication credentials.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete account
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* 4. ABOUT ASTERIAL 1.4.5                                          */}
        {/* ================================================================ */}
        {section === "about" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {ASTERIAL_BRAND.name}
                    </h2>
                    <Badge variant="accent" size="md">
                      v{ASTERIAL_BRAND.version}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {ASTERIAL_BRAND.attribution} · Developed by{" "}
                    {ASTERIAL_BRAND.developer}
                  </p>
                </div>

                <Link
                  href="/download"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-medium text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] transition-colors"
                >
                  <Smartphone className="h-4 w-4" />
                  Android App ({ASTERIAL_BRAND.androidPackageId})
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Release Version
                  </p>
                  <p className="mt-1 font-mono font-semibold text-[var(--text-primary)]">
                    {ASTERIAL_BRAND.version} (code {ASTERIAL_BRAND.versionCode})
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Developer
                  </p>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">
                    {ASTERIAL_BRAND.developer} ({ASTERIAL_BRAND.attribution})
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Android Package
                  </p>
                  <p className="mt-1 font-mono text-[var(--text-primary)]">
                    {ASTERIAL_BRAND.androidPackageId}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[var(--text-muted)]">
                  What’s in v{ASTERIAL_BRAND.version}
                </h3>
                <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] list-disc pl-4">
                  {ASTERIAL_BRAND.releaseNotes.map((note, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Permanent Account Deletion Confirmation Dialog */}
      {deleteDialogOpen && (
        <Dialog
          open
          onClose={() => {
            if (!deletingAccount) setDeleteDialogOpen(false);
          }}
          title="Permanently delete your ASTERIAL account?"
          description="This action cannot be undone. Type DELETE below to confirm permanent account removal."
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>
                Your profile, memberships, private Close Orbit, Moments, and
                authentication record will be permanently erased.
              </span>
            </div>

            <Input
              label='Type "DELETE" to confirm'
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={deletingAccount}
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deletingAccount}
                disabled={deleteConfirmText.trim() !== "DELETE"}
                onClick={() => void handleDeleteAccount()}
              >
                Permanently delete
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
