"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AtSign,
  Camera,
  CheckCircle2,
  Loader2,
  Trash2,
  UserCircle,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { authService, mediaService, settingsService } from "@/lib/services";
import { profileUpdateSchema, usernameSchema } from "@/lib/validation/schemas";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useWorkspace();
  const { pushToast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [draftUsername, setDraftUsername] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null);
  const [draftStatusText, setDraftStatusText] = useState<string | null>(null);
  const [draftBio, setDraftBio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [checkedHandle, setCheckedHandle] = useState<{
    handle: string;
    available: boolean;
  } | null>(null);

  const username = draftUsername ?? profile?.username ?? "";
  const displayName = draftDisplayName ?? profile?.display_name ?? "";
  const statusText = draftStatusText ?? profile?.status_text ?? "";
  const bio = draftBio ?? profile?.bio ?? "";

  const cleanUsername = username.trim().toLowerCase();
  const isSameUsername = Boolean(profile && cleanUsername === profile.username);
  const isUsernameValid = usernameSchema.safeParse(cleanUsername).success;

  useEffect(() => {
    if (!profile || isSameUsername || !isUsernameValid) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = await authService.checkUsernameAvailable(
          cleanUsername,
          profile.username
        );
        if (active) {
          setCheckedHandle({ handle: cleanUsername, available });
        }
      } catch {
        // Ignore transient network errors while typing
      }
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cleanUsername, isSameUsername, isUsernameValid, profile]);

  const usernameStatus: "same" | "checking" | "available" | "taken" | "invalid" =
    isSameUsername
      ? "same"
      : !isUsernameValid
        ? "invalid"
        : checkedHandle?.handle !== cleanUsername
          ? "checking"
          : checkedHandle.available
            ? "available"
            : "taken";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const storagePath = await mediaService.uploadAvatarFile(
        user.id,
        file,
        "avatar"
      );
      await settingsService.updateProfile(user.id, { avatar_url: storagePath });
      await refreshProfile();
      pushToast({ title: "Avatar updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Avatar upload failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    try {
      await settingsService.updateProfile(user.id, { avatar_url: null });
      await refreshProfile();
      pushToast({ title: "Avatar removed", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not remove avatar",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse({
      username,
      displayName,
      bio,
      statusText,
    });
    if (!parsed.success) {
      pushToast({
        title: "Validation error",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }
    if (usernameStatus === "taken") {
      pushToast({
        title: "Username unavailable",
        description: "Choose another unique handle.",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      if (!user) return;
      await settingsService.updateProfile(user.id, {
        username: parsed.data.username,
        display_name: parsed.data.displayName,
        bio: parsed.data.bio,
        status_text: parsed.data.statusText,
      });
      await refreshProfile();
      pushToast({ title: "Profile saved", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not save profile",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8 space-y-8">
        <div className="border-b border-[var(--border-subtle)] pb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <UserCircle className="h-3.5 w-3.5 text-zinc-300" />
            <span>Identity</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
            Profile Management
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Customize your handle, display name, avatar, status, and biography.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.85fr]">
          {/* Edit Form */}
          <form
            onSubmit={handleSave}
            className="space-y-5 rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-6"
          >
            <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.07] pb-5">
              <Avatar
                name={displayName || username || "AS"}
                avatarPath={profile?.avatar_url}
                size="xl"
              />
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={uploadingAvatar}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Change avatar
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRemoveAvatar()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  PNG, JPG, WebP, or GIF up to 5 MB · Stored in private storage.
                </p>
              </div>
            </div>

            <Input
              label="Username"
              value={username}
              onChange={(e) =>
                setDraftUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                )
              }
              maxLength={24}
              leftAddon={<AtSign className="h-4 w-4" />}
              rightAddon={
                usernameStatus === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : usernameStatus === "available" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : usernameStatus === "taken" ? (
                  <XCircle className="h-4 w-4 text-red-400" />
                ) : null
              }
              hint={
                usernameStatus === "available"
                  ? `@${username} is available`
                  : "3–24 lowercase letters, numbers, or underscores"
              }
              error={
                usernameStatus === "taken"
                  ? "That username is already taken."
                  : undefined
              }
              required
            />

            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              maxLength={60}
              required
            />

            <Input
              label="Status line"
              value={statusText}
              onChange={(e) => setDraftStatusText(e.target.value)}
              maxLength={80}
              placeholder="Focused · Available for direct messages"
              hint={`${statusText.length}/80 characters`}
            />

            <Textarea
              label="Biography"
              value={bio}
              onChange={(e) => setDraftBio(e.target.value)}
              maxLength={280}
              placeholder="Share a brief bio..."
              hint={`${bio.length}/280 characters`}
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" loading={saving}>
                Save changes
              </Button>
            </div>
          </form>

          {/* Live Directory Card Preview */}
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Live Card Preview
            </p>
            <div className="rounded-2xl border border-white/[0.1] bg-[var(--bg-surface)] p-6 space-y-4">
              <div className="flex items-center gap-3.5">
                <Avatar
                  name={displayName || username || "AS"}
                  avatarPath={profile?.avatar_url}
                  size="lg"
                  online={profile?.presence_visibility !== "nobody"}
                  showPresence
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {displayName || "Your Name"}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-400">
                    @{username || "username"}
                  </p>
                </div>
              </div>

              {statusText && (
                <div className="rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3 py-2 text-xs text-zinc-200">
                  {statusText}
                </div>
              )}

              <p className="text-xs text-zinc-400 leading-relaxed">
                {bio || "No biography set yet."}
              </p>

              <div className="border-t border-white/[0.07] pt-3 font-mono text-[10px] text-zinc-500 flex items-center justify-between">
                <span>Private Email: {user?.email || "Hidden"}</span>
                <span>Never shown publicly</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
