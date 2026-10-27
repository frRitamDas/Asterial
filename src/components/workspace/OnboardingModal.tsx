"use client";

import React, { useEffect, useRef, useState } from "react";
import { AtSign, Camera, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadAvatarFile } from "@/lib/supabase/storage";
import { profileUpdateSchema, usernameSchema } from "@/lib/validation/schemas";
import { useToast } from "@/components/ui/Toast";

export function OnboardingModal() {
  const { user, profile, refreshProfile } = useWorkspace();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftUsername, setDraftUsername] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null);
  const [draftStatusText, setDraftStatusText] = useState<string | null>(null);
  const [draftBio, setDraftBio] = useState<string | null>(null);
  const [uploadedAvatarPath, setUploadedAvatarPath] = useState<string | null>(
    null
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedHandle, setCheckedHandle] = useState<{
    handle: string;
    available: boolean;
  } | null>(null);

  const username = draftUsername ?? profile?.username ?? "";
  const displayName = draftDisplayName ?? profile?.display_name ?? "";
  const statusText = draftStatusText ?? profile?.status_text ?? "";
  const bio = draftBio ?? profile?.bio ?? "";
  const avatarPath = uploadedAvatarPath ?? profile?.avatar_url ?? null;

  const cleanUsername = username.trim().toLowerCase();
  const isOwnOrEmpty = !cleanUsername || cleanUsername === profile?.username;
  const isFormatValid = usernameSchema.safeParse(cleanUsername).success;

  useEffect(() => {
    if (!profile || profile.onboarding_completed || isOwnOrEmpty || !isFormatValid) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("check_username_available", {
        p_username: cleanUsername,
      });
      if (active) {
        setCheckedHandle({ handle: cleanUsername, available: Boolean(data) });
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cleanUsername, isFormatValid, isOwnOrEmpty, profile]);

  const usernameCheck: "idle" | "checking" | "available" | "taken" =
    isOwnOrEmpty
      ? "available"
      : !isFormatValid
        ? "idle"
        : checkedHandle?.handle !== cleanUsername
          ? "checking"
          : checkedHandle.available
            ? "available"
            : "taken";

  if (!user || !profile || profile.onboarding_completed) {
    return null;
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const path = await uploadAvatarFile(user.id, file, "avatar");
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      setUploadedAvatarPath(path);
      pushToast({ title: "Profile photo uploaded", variant: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = profileUpdateSchema.safeParse({
      username,
      displayName,
      bio,
      statusText,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your profile fields.");
      return;
    }

    if (usernameCheck === "taken") {
      setError("That username is already taken.");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc(
        "complete_profile_onboarding",
        {
          p_username: parsed.data.username,
          p_display_name: parsed.data.displayName,
          p_bio: parsed.data.bio,
          p_status_text: parsed.data.statusText,
        }
      );

      if (rpcErr) {
        setError(rpcErr.message);
        setSaving(false);
        return;
      }

      await refreshProfile();
      pushToast({
        title: "Welcome to ASTERIAL",
        description: "Your profile coordinates are set.",
        variant: "success",
      });
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-asterial-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-lg rounded-2xl border border-white/20 bg-[var(--bg-surface)] p-6 sm:p-7 shadow-2xl"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span>First-Run Setup · ASTERIAL</span>
        </div>
        <h2
          id="onboarding-title"
          className="mt-2 text-xl font-semibold tracking-tight text-white"
        >
          Complete your ASTERIAL identity
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Choose how people discover and recognize you across conversations.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <Avatar
              name={displayName || username || "AS"}
              avatarPath={avatarPath}
              size="lg"
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                Upload avatar
              </Button>
              <p className="mt-1 text-[11px] text-zinc-500">
                Optional · PNG, JPG, WebP, or GIF up to 5 MB
              </p>
            </div>
          </div>

          <Input
            label="Unique username"
            value={username}
            onChange={(e) =>
              setDraftUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
              )
            }
            maxLength={24}
            leftAddon={<AtSign className="h-4 w-4" />}
            rightAddon={
              usernameCheck === "checking" ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              ) : usernameCheck === "available" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : null
            }
            required
          />

          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDraftDisplayName(e.target.value)}
            maxLength={60}
            placeholder="Your name"
            required
          />

          <Input
            label="Status (optional)"
            value={statusText}
            onChange={(e) => setDraftStatusText(e.target.value)}
            maxLength={80}
            placeholder="Building in the quiet hours"
          />

          <Textarea
            label="Bio (optional)"
            value={bio}
            onChange={(e) => setDraftBio(e.target.value)}
            maxLength={280}
            placeholder="A brief note about yourself..."
            className="min-h-[72px]"
          />

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" loading={saving}>
              Enter Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
