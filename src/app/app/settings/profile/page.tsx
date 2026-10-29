"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AtSign,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { authService, mediaService, settingsService } from "@/lib/services";
import { profileUpdateSchema, usernameSchema } from "@/lib/validation/schemas";

export default function SettingsProfilePage() {
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

  const isDirty = Boolean(
    profile &&
      (username !== profile.username ||
        displayName !== profile.display_name ||
        statusText !== (profile.status_text || "") ||
        bio !== (profile.bio || ""))
  );

  // Unsaved-changes browser navigation guard
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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
    }, 260);
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

  const resetDrafts = () => {
    setDraftUsername(null);
    setDraftDisplayName(null);
    setDraftStatusText(null);
    setDraftBio(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const parsed = profileUpdateSchema.safeParse({
      displayName,
      username: cleanUsername,
      bio,
      statusText,
    });

    if (!parsed.success) {
      pushToast({
        title: "Check profile fields",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    if (usernameStatus === "taken") {
      pushToast({
        title: "Username unavailable",
        description: `@${cleanUsername} is already taken.`,
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      await settingsService.updateProfile(user.id, {
        display_name: parsed.data.displayName,
        username: parsed.data.username,
        bio: parsed.data.bio,
        status_text: parsed.data.statusText,
      });
      await refreshProfile();
      resetDrafts();
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Profile" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Profile
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Update your avatar, display name, @username, bio, and custom
              status.
            </p>
          </div>

          {/* Avatar Card */}
          <section className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName || username || "A"}
                avatarPath={profile?.avatar_url}
                size="xl"
              />
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Profile Photo
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  PNG, JPEG, WebP, or GIF up to 5 MB. Stored in private bucket
                  storage.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{profile?.avatar_url ? "Change" : "Upload"}</span>
              </Button>
              {profile?.avatar_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleRemoveAvatar()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </Button>
              )}
            </div>
          </section>

          {/* Profile Form */}
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
          >
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              maxLength={50}
              placeholder="Your name"
              required
            />

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
              hint={
                usernameStatus === "same"
                  ? "Your current @username"
                  : usernameStatus === "available"
                    ? `@${cleanUsername} is available`
                    : usernameStatus === "taken"
                      ? `@${cleanUsername} is already taken`
                      : "3–24 lowercase letters, numbers, or underscores"
              }
              rightAddon={
                usernameStatus === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : usernameStatus === "available" ||
                  usernameStatus === "same" ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                ) : usernameStatus === "taken" ? (
                  <XCircle className="h-4 w-4 text-[var(--danger)]" />
                ) : null
              }
              required
            />

            <Input
              label="Custom status"
              value={statusText}
              onChange={(e) => setDraftStatusText(e.target.value)}
              maxLength={80}
              placeholder="e.g. Focusing on release v1.6"
              hint={`${statusText.length}/80 characters`}
            />

            <Textarea
              label="Bio"
              value={bio}
              onChange={(e) => setDraftBio(e.target.value)}
              maxLength={160}
              placeholder="A brief bio shown on your profile card"
              hint={`${bio.length}/160 characters`}
            />

            {isDirty && (
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--accent)]/35 bg-[var(--accent-signal-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] animate-asterial-in">
                <span>You have unsaved profile changes.</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={resetDrafts}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={saving}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            )}

            {!isDirty && (
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled
                >
                  Saved
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
