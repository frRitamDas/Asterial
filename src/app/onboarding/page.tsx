"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bell,
  Camera,
  Check,
  Compass,
  Laptop,
  Loader2,
  MessageSquare,
  Moon,
  Search,
  Shield,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { resolveAppearanceTheme, type AppearanceTheme } from "@asterial/core";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  conversationsService,
  contactsService,
  mediaService,
  settingsService,
} from "@/lib/services";
import type { Profile, UserSearchResult } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";

type OnboardingStep = 3 | 4 | 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<OnboardingStep>(3);

  // Screen 3 — Profile Setup state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "current" | "taken" | "invalid"
  >("current");
  const [savingStep3, setSavingStep3] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Screen 4 — Preferences state
  const [themeChoice, setThemeChoice] = useState<
    "obsidian" | "alabaster" | "system"
  >("obsidian");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showReadReceipts, setShowReadReceipts] = useState(true);
  const [showOnlineAndLastSeen, setShowOnlineAndLastSeen] = useState(true);
  const [savingStep4, setSavingStep4] = useState(false);

  // Screen 5 — Start Communicating state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const loadCurrentState = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;
        if (error || !user) {
          router.replace("/login?next=/onboarding");
          return;
        }

        setUserId(user.id);
        const [profileRes, prefsRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!active) return;

        if (profileRes.data) {
          const p = profileRes.data as Profile;
          setDisplayName(p.display_name || "");
          setUsername(p.username || "");
          setOriginalUsername(p.username || "");
          setBio(p.bio || "");
          setAvatarUrl(p.avatar_url || null);
          setShowReadReceipts(p.read_receipts_enabled !== false);
          setShowOnlineAndLastSeen(p.presence_visibility !== "nobody");
        }

        if (prefsRes.data) {
          const t = prefsRes.data.appearance_theme as AppearanceTheme;
          if (t === "alabaster" || t === "system") {
            setThemeChoice(t);
          } else {
            setThemeChoice("obsidian");
          }
          setNotificationsEnabled(prefsRes.data.in_app_enabled !== false);
        }
      } catch {
        // Keep defaults on transient error
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadCurrentState();
    return () => {
      active = false;
    };
  }, [router]);

  // Apply chosen theme live during Screen 4
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const prefersLight = window.matchMedia(
      "(prefers-color-scheme: light)"
    ).matches;
    const resolved = resolveAppearanceTheme(themeChoice, prefersLight);
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved !== "alabaster");
  }, [themeChoice]);

  // Live @username availability check on Screen 3
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      const t = window.setTimeout(() => setUsernameStatus("invalid"), 0);
      return () => window.clearTimeout(t);
    }
    if (clean === originalUsername.toLowerCase()) {
      const t = window.setTimeout(() => setUsernameStatus("current"), 0);
      return () => window.clearTimeout(t);
    }
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
      const t = window.setTimeout(() => setUsernameStatus("invalid"), 0);
      return () => window.clearTimeout(t);
    }

    const timer = window.setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("check_username_available", {
          p_username: clean,
        });
        if (!error && typeof data === "boolean") {
          setUsernameStatus(data ? "available" : "taken");
        } else {
          setUsernameStatus("idle");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [originalUsername, username]);

  // Live people search on Screen 5
  useEffect(() => {
    if (step !== 5) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchingPeople(true);
      try {
        const items = await contactsService.searchUsers(searchQuery, 8);
        if (active) setSearchResults(items);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchingPeople(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, step]);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;

    setUploadingAvatar(true);
    setStep3Error(null);
    try {
      const path = await mediaService.uploadAvatarFile(userId, file, "profile");
      setAvatarUrl(path);
      pushToast({ title: "Profile photo uploaded", variant: "success" });
    } catch (err) {
      setStep3Error(
        err instanceof Error ? err.message : "Could not upload profile photo."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveStep3AndContinue = async (skipOptional = false) => {
    if (!userId) return;
    setStep3Error(null);

    const trimmedName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (trimmedName.length < 1 || trimmedName.length > 50) {
      setStep3Error("Display name must be between 1 and 50 characters.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setStep3Error(
        "Username must be 3–24 lowercase letters, numbers, or underscores."
      );
      return;
    }
    if (usernameStatus === "taken") {
      setStep3Error("That @username is already taken.");
      return;
    }

    setSavingStep3(true);
    try {
      await settingsService.updateProfile(userId, {
        display_name: trimmedName,
        username: cleanUsername,
        bio: skipOptional ? "" : bio.trim().slice(0, 160),
        avatar_url: avatarUrl,
      });
      setOriginalUsername(cleanUsername);
      setStep(4);
    } catch (err) {
      setStep3Error(
        err instanceof Error ? err.message : "Unable to save your profile."
      );
    } finally {
      setSavingStep3(false);
    }
  };

  const handleToggleNotifications = async (checked: boolean) => {
    setNotificationsEnabled(checked);
    if (
      checked &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // Non-blocking if browser blocks permission prompt
      }
    }
  };

  const saveStep4AndComplete = async () => {
    if (!userId) return;
    setSavingStep4(true);
    try {
      await Promise.all([
        settingsService.upsertPreferences(userId, {
          appearance_theme: themeChoice,
          in_app_enabled: notificationsEnabled,
        }),
        settingsService.updateProfile(userId, {
          read_receipts_enabled: showReadReceipts,
          presence_visibility: showOnlineAndLastSeen ? "everyone" : "nobody",
          onboarding_completed: true,
        }),
      ]);
      setStep(5);
    } catch (err) {
      pushToast({
        title: "Could not save preferences",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSavingStep4(false);
    }
  };

  const handleStartDmFromOnboarding = async (targetUserId: string) => {
    setStartingUserId(targetUserId);
    try {
      const convId =
        await conversationsService.createOrGetDirectConversation(targetUserId);
      router.push(`/app/chats/${convId}`);
    } catch (err) {
      pushToast({
        title: "Could not start direct message",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setStartingUserId(null);
    }
  };

  const stepsMeta = [
    { num: 1, label: "Welcome", done: true },
    { num: 2, label: "Account", done: true },
    { num: 3, label: "Profile", done: step > 3, active: step === 3 },
    { num: 4, label: "Preferences", done: step > 4, active: step === 4 },
    { num: 5, label: "Start", done: false, active: step === 5 },
  ];

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--background)] flex items-center justify-center text-xs text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span>Preparing your workspace…</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--text-primary)] flex flex-col justify-between px-4 py-6 sm:px-8">
      {/* Header + 5-Step Progress Indicator */}
      <header className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <AsterialLogo size="sm" />
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Step {step} of 5
          </span>
        </div>

        <ol
          aria-label="Onboarding steps"
          className="grid grid-cols-5 gap-2"
        >
          {stepsMeta.map((item) => (
            <li key={item.num} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-200",
                  item.done || item.active
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border-subtle)]"
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-medium truncate",
                  item.active
                    ? "text-[var(--text-primary)]"
                    : item.done
                      ? "text-[var(--text-secondary)]"
                      : "text-[var(--text-muted)]"
                )}
              >
                {item.num}. {item.label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      {/* Main Step Card */}
      <main className="mx-auto my-8 w-full max-w-xl">
        {step === 3 && (
          <section
            key="step-3"
            className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-7 shadow-xl animate-asterial-rise"
          >
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Set up your profile
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                Choose how you appear in direct messages, groups, and People
                search.
              </p>
            </div>

            {step3Error && (
              <div
                role="alert"
                className="mb-4 rounded-[12px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs text-[var(--danger)]"
              >
                {step3Error}
              </div>
            )}

            {/* Avatar Upload or Fallback Initials */}
            <div className="mb-6 flex items-center gap-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5">
              <Avatar
                name={displayName || username || "A"}
                avatarPath={avatarUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  Profile photo (optional)
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  PNG, JPEG, or WebP. Initials are shown cleanly if skipped.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{avatarUrl ? "Change photo" : "Upload photo"}</span>
                  </Button>
                  {avatarUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAvatarUrl(null)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Use initials</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Display name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                required
              />

              <Input
                label="Unique @username"
                placeholder="your_handle"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                }
                leftAddon={<AtSign className="h-4 w-4" />}
                hint={
                  usernameStatus === "available"
                    ? `@${username} is available`
                    : usernameStatus === "current"
                      ? `Reserved for your account`
                      : usernameStatus === "taken"
                        ? `@${username} is already taken`
                        : "3–24 lowercase letters, numbers, or underscores"
                }
                rightAddon={
                  usernameStatus === "checking" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : usernameStatus === "available" ||
                    usernameStatus === "current" ? (
                    <Check className="h-4 w-4 text-[var(--success)]" />
                  ) : null
                }
                required
              />

              <Textarea
                label="Short bio (optional)"
                placeholder="What are you working on or interested in?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                hint={`${bio.length}/160 characters`}
                className="min-h-[76px]"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
              <Button
                variant="ghost"
                size="md"
                disabled={savingStep3}
                onClick={() => void saveStep3AndContinue(true)}
              >
                Skip optional fields
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={savingStep3}
                onClick={() => void saveStep3AndContinue(false)}
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section
            key="step-4"
            className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-7 shadow-xl animate-asterial-rise"
          >
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Appearance & privacy defaults
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                Everything here applies immediately and can be changed anytime
                in Settings.
              </p>
            </div>

            {/* Theme Selection */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Theme
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    id: "obsidian" as const,
                    label: "Dark",
                    desc: "Near-black focus",
                    icon: Moon,
                  },
                  {
                    id: "alabaster" as const,
                    label: "Light",
                    desc: "Crisp daylight",
                    icon: Sun,
                  },
                  {
                    id: "system" as const,
                    label: "System",
                    desc: "Match device",
                    icon: Laptop,
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = themeChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeChoice(opt.id)}
                      className={cn(
                        "flex flex-col items-start rounded-[12px] border p-3 text-left transition-colors cursor-pointer",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active
                            ? "text-[var(--accent)]"
                            : "text-[var(--text-secondary)]"
                        )}
                      />
                      <span className="mt-2 text-xs font-semibold text-[var(--text-primary)]">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification & Privacy Toggles */}
            <div className="mt-6 space-y-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <Bell className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Notifications</span>
              </div>
              <Switch
                id="onb-notifications"
                checked={notificationsEnabled}
                onCheckedChange={(v) => void handleToggleNotifications(v)}
                label="Message & group notifications"
                description="Play subtle alerts and show desktop notifications when new messages arrive."
              />

              <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <Shield className="h-3.5 w-3.5 text-[var(--success)]" />
                <span>Privacy defaults</span>
              </div>

              <Switch
                id="onb-receipts"
                checked={showReadReceipts}
                onCheckedChange={setShowReadReceipts}
                label="Read receipts"
                description="Let people see when you read messages. Turning this off also hides read receipts from others."
              />

              <Switch
                id="onb-presence"
                checked={showOnlineAndLastSeen}
                onCheckedChange={setShowOnlineAndLastSeen}
                label="Last seen & online visibility"
                description="Show when you are active now or recently active in direct conversations."
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setStep(3)}
                disabled={savingStep4}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={savingStep4}
                onClick={() => void saveStep4AndComplete()}
              >
                <span>Save & Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section
            key="step-5"
            className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-7 shadow-xl animate-asterial-rise"
          >
            <div className="mb-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--success)]">
                <Check className="h-3.5 w-3.5" />
                <span>Setup complete</span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Start communicating
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                Find someone by @username right now, create a group, or open
                your workspace.
              </p>
            </div>

            {/* Live People Search by @username */}
            <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5">
              <Input
                placeholder="Find people by @username or display name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />

              <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
                {searchingPeople ? (
                  <div className="flex items-center justify-center py-4 text-xs text-[var(--text-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    <span>Searching directory…</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-3 text-center text-xs text-[var(--text-muted)]">
                    No matching profiles found yet.
                  </p>
                ) : (
                  searchResults.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--surface)] px-3 py-2 border border-[var(--border-subtle)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={person.display_name}
                          avatarPath={person.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {person.display_name}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-secondary)]">
                            @{person.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={startingUserId === person.id}
                        onClick={() =>
                          void handleStartDmFromOnboarding(person.id)
                        }
                      >
                        Message
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Link
                href="/app/chats?action=new-dm"
                className="flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Start a direct message
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Open a 1:1 conversation
                  </p>
                </div>
              </Link>

              <Link
                href="/app/chats?action=new-group"
                className="flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Users className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Create a group
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Bring multiple people together
                  </p>
                </div>
              </Link>

              <Link
                href="/app/people"
                className="flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Search className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Browse People directory
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Find profiles & build Close Orbit
                  </p>
                </div>
              </Link>

              <Link
                href="/app/feed"
                className="flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Compass className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Explore Moments & Feed
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    See updates from your space
                  </p>
                </div>
              </Link>
            </div>

            <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push("/app/chats")}
              >
                <span>Open Chats Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-2xl items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Your settings sync across web and Android</span>
        <Link
          href="/app/chats"
          className="hover:text-[var(--text-primary)] transition-colors"
        >
          Go to workspace
        </Link>
      </footer>
    </div>
  );
}
