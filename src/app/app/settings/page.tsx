"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Download,
  Info,
  KeyRound,
  LogOut,
  Monitor,
  Palette,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  UserCheck,
  UserCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { AppUpdatePanel } from "@/components/native/AppUpdatePanel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { passwordUpdateSchema } from "@/lib/validation/schemas";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import type {
  AllowDirectMessages,
  AppearanceTheme,
  MessageDensity,
  PresenceVisibility,
} from "@/lib/types/database";

type SettingsSection =
  | "profile"
  | "security"
  | "appearance"
  | "notifications"
  | "privacy"
  | "blocked"
  | "data"
  | "about";

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "security", label: "Account Security", icon: KeyRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "blocked", label: "Blocked Users", icon: UserCheck },
  { id: "data", label: "Sessions & Data", icon: Monitor },
  { id: "about", label: "Updates & About", icon: Info },
];

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    profile,
    preferences,
    blockedProfiles,
    refreshProfile,
    updatePreferences,
    unblockUser,
    signOut,
  } = useWorkspace();
  const { pushToast } = useToast();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");

  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Account deletion dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleUpdatePrivacy = async (patch: {
    presence_visibility?: PresenceVisibility;
    read_receipts_enabled?: boolean;
    allow_direct_messages?: AllowDirectMessages;
  }) => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (error) {
      pushToast({
        title: "Could not update privacy setting",
        description: error.message,
        variant: "error",
      });
    } else {
      await refreshProfile();
      if (patch.presence_visibility) {
        void supabase.rpc("touch_presence");
      }
      pushToast({ title: "Privacy settings updated", variant: "success" });
    }
  };

  const handleToggleBrowserNotifications = async (enable: boolean) => {
    if (!enable) {
      await updatePreferences({ browser_enabled: false });
      return;
    }

    if (typeof Notification === "undefined") {
      pushToast({
        title: "Browser notifications unsupported",
        description: "Your current browser does not expose the Notification API.",
        variant: "error",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await updatePreferences({ browser_enabled: true });
      pushToast({
        title: "Browser notifications enabled",
        variant: "success",
      });
    } else {
      await updatePreferences({ browser_enabled: false });
      pushToast({
        title: "Permission denied",
        description:
          "Allow notifications in your browser site settings to enable desktop alerts.",
        variant: "error",
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordUpdateSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      pushToast({
        title: "Invalid password",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        pushToast({
          title: "Could not update password",
          description: error.message,
          variant: "error",
        });
      } else {
        setNewPassword("");
        setConfirmPassword("");
        pushToast({
          title: "Password updated",
          description: "Your new credentials are active.",
          variant: "success",
        });
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleExportAccountData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      application: `${ASTERIAL_BRAND.name} v${ASTERIAL_BRAND.version}`,
      account: {
        id: user?.id,
        email: user?.email,
        createdAt: user?.created_at,
        lastSignInAt: user?.last_sign_in_at,
      },
      profile,
      preferences,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asterial-account-${profile?.username || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);

    try {
      // Attempt server route first, then fall back to authenticated database RPC
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      }).catch(() => null);

      if (!res || !res.ok) {
        const supabase = getSupabaseBrowserClient();
        if (profile?.avatar_url) {
          await supabase.storage
            .from("avatars")
            .remove([profile.avatar_url])
            .catch(() => {});
        }
        if (user?.id) {
          const { data: attRows } = await supabase
            .from("attachments")
            .select("storage_path")
            .eq("uploader_id", user.id)
            .limit(500);
          const paths = ((attRows || []) as Array<{ storage_path: string }>).map(
            (r) => r.storage_path
          );
          if (paths.length > 0) {
            await supabase.storage
              .from("chat-attachments")
              .remove(paths)
              .catch(() => {});
          }
        }
        const { error: rpcErr } = await supabase.rpc("delete_own_account");
        if (rpcErr) {
          throw new Error(rpcErr.message);
        }
      }

      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => {});
      router.replace("/");
    } catch (err) {
      pushToast({
        title: "Account deletion failed",
        description:
          err instanceof Error ? err.message : "Unable to delete account.",
        variant: "error",
      });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 space-y-7">
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)] pb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <SettingsIcon className="h-3.5 w-3.5 text-zinc-300" />
            <span>Configuration</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
            Settings &amp; Privacy
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Control your security, workspace appearance, notifications, and
            enforced privacy rules.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          {/* Section Navigation */}
          <nav
            aria-label="Settings sections"
            className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0"
          >
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-white text-zinc-950"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Section Content */}
          <div className="rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-6 space-y-6">
            {activeSection === "profile" && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-white">
                  Profile Overview
                </h2>
                {profile && (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-4">
                    <div className="flex items-center gap-3.5">
                      <Avatar
                        name={profile.display_name}
                        avatarPath={profile.avatar_url}
                        size="lg"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {profile.display_name}
                        </p>
                        <p className="font-mono text-xs text-zinc-400">
                          @{profile.username}
                        </p>
                        {profile.status_text && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {profile.status_text}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/app/profile"
                      className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
                    >
                      Edit profile
                    </Link>
                  </div>
                )}
              </div>
            )}

            {activeSection === "security" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Account Security
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Manage your authentication email and password.
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-4">
                  <p className="text-xs text-zinc-500">Registered email</p>
                  <p className="mt-0.5 font-mono text-sm text-white">
                    {user?.email || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Your email address is kept private and is never exposed in
                    contact discovery.
                  </p>
                </div>

                <form
                  onSubmit={handlePasswordChange}
                  className="space-y-4 border-t border-white/[0.08] pt-5"
                >
                  <h3 className="text-sm font-semibold text-white">
                    Change password
                  </h3>
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={updatingPassword}
                  >
                    Update password
                  </Button>
                </form>
              </div>
            )}

            {activeSection === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Appearance
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Tailor ASTERIAL&apos;s dark-first monochrome surfaces and
                    layout density.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Surface Theme
                  </label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(
                      [
                        [
                          "obsidian",
                          "Obsidian",
                          "Signature deep carbon contrast",
                        ],
                        [
                          "pitch",
                          "OLED Pitch",
                          "True #000000 black for OLED panels",
                        ],
                        [
                          "graphite",
                          "Graphite",
                          "Softened neutral charcoal tones",
                        ],
                        [
                          "alabaster",
                          "Alabaster Light",
                          "Crisp daylight neutral surfaces",
                        ],
                      ] as Array<[AppearanceTheme, string, string]>
                    ).map(([themeId, title, desc]) => {
                      const active =
                        (preferences?.appearance_theme || "obsidian") ===
                        themeId;
                      return (
                        <button
                          key={themeId}
                          type="button"
                          onClick={() =>
                            void updatePreferences({
                              appearance_theme: themeId,
                            })
                          }
                          className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                            active
                              ? "border-white bg-white/[0.08]"
                              : "border-white/10 bg-[var(--bg-canvas)] hover:border-white/25"
                          }`}
                        >
                          <p className="text-xs font-semibold text-white">
                            {title}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Message Density
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        ["comfortable", "Comfortable"],
                        ["compact", "Compact"],
                      ] as Array<[MessageDensity, string]>
                    ).map(([densityId, label]) => {
                      const active =
                        (preferences?.message_density || "comfortable") ===
                        densityId;
                      return (
                        <button
                          key={densityId}
                          type="button"
                          onClick={() =>
                            void updatePreferences({
                              message_density: densityId,
                            })
                          }
                          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? "border-white bg-white text-zinc-950"
                              : "border-white/10 bg-[var(--bg-canvas)] text-zinc-300 hover:border-white/25"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/[0.08] pt-4">
                  <Switch
                    id="reduced-motion-switch"
                    checked={Boolean(preferences?.reduced_motion)}
                    onCheckedChange={(checked) =>
                      void updatePreferences({ reduced_motion: checked })
                    }
                    label="Reduce motion"
                    description="Minimize interface transitions and micro-animations across the workspace."
                  />
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Notifications
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Choose how ASTERIAL alerts you when new messages arrive.
                  </p>
                </div>

                <Switch
                  id="notif-inapp"
                  checked={preferences?.in_app_enabled !== false}
                  onCheckedChange={(checked) =>
                    void updatePreferences({ in_app_enabled: checked })
                  }
                  label="In-app notification banners"
                  description="Show toast banners for incoming messages in inactive threads."
                />

                <Switch
                  id="notif-sound"
                  checked={preferences?.sound_enabled !== false}
                  onCheckedChange={(checked) =>
                    void updatePreferences({ sound_enabled: checked })
                  }
                  label="Notification chime"
                  description="Play a subtle harmonic tone on incoming messages."
                />

                <Switch
                  id="notif-preview"
                  checked={preferences?.message_preview !== false}
                  onCheckedChange={(checked) =>
                    void updatePreferences({ message_preview: checked })
                  }
                  label="Show message previews"
                  description="Include message text snippets inside notification alerts."
                />

                <Switch
                  id="notif-dm"
                  checked={preferences?.dm_notifications !== false}
                  onCheckedChange={(checked) =>
                    void updatePreferences({ dm_notifications: checked })
                  }
                  label="Direct message alerts"
                  description="Notify for one-to-one conversations (unless muted)."
                />

                <Switch
                  id="notif-group"
                  checked={preferences?.group_notifications !== false}
                  onCheckedChange={(checked) =>
                    void updatePreferences({ group_notifications: checked })
                  }
                  label="Group message alerts"
                  description="Notify for group conversations (unless muted)."
                />

                <div className="border-t border-white/[0.08] pt-4">
                  <Switch
                    id="notif-browser"
                    checked={Boolean(preferences?.browser_enabled)}
                    onCheckedChange={(checked) =>
                      void handleToggleBrowserNotifications(checked)
                    }
                    label="Browser desktop notifications"
                    description="Request browser permission to display system notifications when ASTERIAL is in the background."
                  />
                </div>
              </div>
            )}

            {activeSection === "privacy" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Privacy Controls
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    All privacy settings are enforced server-side by PostgreSQL
                    Row Level Security and database workflows.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">
                    Online Presence &amp; Last-Seen Visibility
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["everyone", "Everyone", "Visible to signed-in users"],
                        [
                          "contacts",
                          "Contacts Only",
                          "Only direct conversation peers",
                        ],
                        [
                          "nobody",
                          "Nobody",
                          "Hide online & last-seen status",
                        ],
                      ] as Array<[PresenceVisibility, string, string]>
                    ).map(([vis, title, sub]) => {
                      const active =
                        (profile?.presence_visibility || "everyone") === vis;
                      return (
                        <button
                          key={vis}
                          type="button"
                          onClick={() =>
                            void handleUpdatePrivacy({
                              presence_visibility: vis,
                            })
                          }
                          className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                            active
                              ? "border-white bg-white/[0.08]"
                              : "border-white/10 bg-[var(--bg-canvas)] hover:border-white/25"
                          }`}
                        >
                          <p className="text-xs font-semibold text-white">
                            {title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {sub}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Switch
                  id="privacy-read-receipts"
                  checked={profile?.read_receipts_enabled !== false}
                  onCheckedChange={(checked) =>
                    void handleUpdatePrivacy({ read_receipts_enabled: checked })
                  }
                  label="Read receipts"
                  description="Let others see when you have read their messages. Disabling also hides outgoing read states."
                />

                <Switch
                  id="privacy-allow-dms"
                  checked={
                    (profile?.allow_direct_messages || "everyone") ===
                    "everyone"
                  }
                  onCheckedChange={(checked) =>
                    void handleUpdatePrivacy({
                      allow_direct_messages: checked ? "everyone" : "none",
                    })
                  }
                  label="Allow new direct conversations"
                  description="When disabled, other users cannot initiate new 1:1 threads with your account."
                />
              </div>
            )}

            {activeSection === "blocked" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Blocked Accounts ({blockedProfiles.length})
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Blocked users cannot start direct conversations or send new
                    direct messages to you.
                  </p>
                </div>

                {blockedProfiles.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-8 text-center text-xs text-zinc-500">
                    You have not blocked any accounts.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedProfiles.map((bp) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={bp.display_name}
                            avatarPath={bp.avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-white">
                              {bp.display_name}
                            </p>
                            <p className="truncate font-mono text-[11px] text-zinc-500">
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
              </div>
            )}

            {activeSection === "data" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Active Session &amp; Data Management
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Inspect your current authenticated session, export account
                    metadata, or permanently delete your account.
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Authenticated User ID</span>
                    <span className="font-mono text-zinc-300 truncate max-w-[200px]">
                      {user?.id || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Last Sign-In</span>
                    <span className="font-mono text-zinc-300">
                      {user?.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString()
                        : "Active"}
                    </span>
                  </div>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleExportAccountData}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export profile &amp; settings JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void signOut()}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out of this device
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-red-200">
                    Permanent Account Deletion
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Deleting your account permanently removes your ASTERIAL
                    profile, uploaded storage files, memberships, and
                    authentication credentials. This action cannot be undone.
                  </p>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete my account
                  </Button>
                </div>
              </div>
            )}

            {activeSection === "about" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                  <AsterialLogo showVersion showAttribution size="md" />
                  <span className="font-mono text-xs text-zinc-500">
                    {ASTERIAL_BRAND.releaseDate}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-3.5">
                    <p className="text-zinc-500">Product</p>
                    <p className="mt-1 font-semibold text-white">
                      {ASTERIAL_BRAND.name}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-3.5">
                    <p className="text-zinc-500">Release</p>
                    <p className="mt-1 font-mono font-semibold text-white">
                      v{ASTERIAL_BRAND.semver} (Code {ASTERIAL_BRAND.versionCode})
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-3.5">
                    <p className="text-zinc-500">Official Developer</p>
                    <p className="mt-1 font-semibold text-white">
                      {ASTERIAL_BRAND.developer} ({ASTERIAL_BRAND.attribution})
                    </p>
                  </div>
                </div>

                {/* Live Android & Release Update Checker */}
                <AppUpdatePanel />

                <div className="space-y-2">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                    Version {ASTERIAL_BRAND.semver} Release Highlights
                  </h3>
                  <ul className="space-y-1.5 text-xs text-zinc-300 list-disc pl-4">
                    {ASTERIAL_BRAND.releaseNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-canvas)] p-4 text-xs text-zinc-400 leading-relaxed">
                  <p className="font-medium text-white mb-1">
                    Security &amp; Encryption Disclosure
                  </p>
                  <p>{ASTERIAL_BRAND.securityNotice}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <Link href="/download" className="hover:text-white underline">
                    Android App &amp; APK Guide
                  </Link>
                  <Link href="/privacy" className="hover:text-white underline">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="hover:text-white underline">
                    Terms of Service
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Account Deletion Modal */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmText("");
        }}
        title="Permanently delete your ASTERIAL account?"
        description="This immediately erases your profile, uploaded files, and login credentials."
      >
        <div className="space-y-4">
          <Input
            label='Type "DELETE" to confirm'
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmText !== "DELETE"}
              loading={deletingAccount}
              onClick={() => void handleConfirmDeleteAccount()}
            >
              Permanently delete account
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
