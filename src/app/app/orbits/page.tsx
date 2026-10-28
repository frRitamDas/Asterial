"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  Globe,
  Hash,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { OrbitMemberRow, OrbitRow, OrbitVisibility } from "@asterial/core";
import { orbitCreateSchema } from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, uploadAvatarFile } from "@/lib/supabase/storage";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";

function slugifyOrbitName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 36);
}

export default function OrbitsDirectoryPage() {
  const router = useRouter();
  const { user } = useWorkspace();
  const { pushToast } = useToast();

  const [orbits, setOrbits] = useState<OrbitRow[]>([]);
  const [memberships, setMemberships] = useState<Record<string, OrbitMemberRow>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [tab, setTab] = useState<"joined" | "discover">("joined");
  const [searchQuery, setSearchQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [draftDesc, setDraftDesc] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<OrbitVisibility>("public");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchOrbits = useCallback(async () => {
    if (!user?.id) return;
    setErrorText(null);
    const supabase = getSupabaseBrowserClient();

    const [orbitsRes, membersRes] = await Promise.all([
      supabase
        .from("orbits")
        .select("*")
        .is("deleted_at", null)
        .order("member_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("orbit_members")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "invited"]),
    ]);

    if (orbitsRes.error) {
      setErrorText(orbitsRes.error.message);
      setLoading(false);
      return;
    }

    const rows = (orbitsRes.data || []) as OrbitRow[];
    const memberMap: Record<string, OrbitMemberRow> = {};
    for (const m of (membersRes.data || []) as OrbitMemberRow[]) {
      memberMap[m.orbit_id] = m;
    }

    await primeAvatarSignedUrls(rows.map((r) => r.icon_url));
    setOrbits(rows);
    setMemberships(memberMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchOrbits();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchOrbits]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`web-orbits-dir-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orbits" },
        () => {
          void fetchOrbits();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchOrbits();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrbits, user?.id]);

  const joinedOrbits = useMemo(
    () =>
      orbits.filter(
        (o) =>
          memberships[o.id]?.status === "active" ||
          memberships[o.id]?.status === "invited"
      ),
    [memberships, orbits]
  );

  const filteredOrbits = useMemo(() => {
    const source = tab === "joined" ? joinedOrbits : orbits;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
    );
  }, [joinedOrbits, orbits, searchQuery, tab]);

  const handleJoinOrbit = async (orbit: OrbitRow) => {
    if (joiningId) return;
    setJoiningId(orbit.id);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("join_orbit", {
      p_orbit_id: orbit.id,
    });
    setJoiningId(null);

    if (error) {
      pushToast({
        title: "Unable to join Orbit",
        description: error.message,
        variant: "error",
      });
      return;
    }

    pushToast({
      title: `Joined ${orbit.name}`,
      description: `Welcome to @${orbit.slug}.`,
      variant: "success",
    });
    await fetchOrbits();
    router.push(`/app/orbits/${orbit.id}`);
  };

  const handleCreateOrbit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || creating) return;
    setCreateError(null);

    const parsed = orbitCreateSchema.safeParse({
      name: draftName,
      slug: draftSlug || slugifyOrbitName(draftName),
      description: draftDesc,
      visibility: draftVisibility,
    });

    if (!parsed.success) {
      setCreateError(
        parsed.error.issues[0]?.message || "Check Orbit details and try again."
      );
      return;
    }

    setCreating(true);
    try {
      let iconPath: string | null = null;
      if (iconFile) {
        iconPath = await uploadAvatarFile(user.id, iconFile, "orbit");
      }

      const supabase = getSupabaseBrowserClient();
      const { data: orbitId, error } = await supabase.rpc("create_orbit", {
        p_name: parsed.data.name,
        p_slug: parsed.data.slug,
        p_description: parsed.data.description,
        p_visibility: parsed.data.visibility,
        p_icon_url: iconPath,
      });

      if (error || !orbitId) {
        throw new Error(error?.message || "Could not create Orbit.");
      }

      setCreateOpen(false);
      setDraftName("");
      setDraftSlug("");
      setSlugTouched(false);
      setDraftDesc("");
      setIconFile(null);
      pushToast({
        title: "Orbit launched",
        description: `@${parsed.data.slug} is ready.`,
        variant: "success",
      });
      await fetchOrbits();
      router.push(`/app/orbits/${orbitId as string}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create Orbit."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              <Globe className="h-3.5 w-3.5" />
              <span>Orbits · Community System</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              Communities built around shared signal
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Structured multi-channel communities with public discovery,
              invite-only private spaces, and role-based governance.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void fetchOrbits()}
              aria-label="Refresh Orbits"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Orbit
            </Button>
          </div>
        </header>

        {/* Tabs + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Orbit views"
            className="inline-flex rounded-xl border border-white/10 bg-[var(--bg-surface)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "joined"}
              onClick={() => setTab("joined")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                tab === "joined"
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              My Orbits ({joinedOrbits.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "discover"}
              onClick={() => setTab("discover")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                tab === "discover"
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Discover ({orbits.length})
            </button>
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder="Search Orbits by name or @handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Error Banner */}
        {errorText && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <span>{errorText}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void fetchOrbits()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        ) : filteredOrbits.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] px-6 py-14 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-[var(--bg-elevated)] text-zinc-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-base font-semibold text-white">
                {searchQuery.trim()
                  ? "No matching Orbits found"
                  : tab === "joined"
                    ? "You haven't joined an Orbit yet"
                    : "No public Orbits published yet"}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {tab === "joined"
                  ? "Explore public communities in Discover or launch your own Orbit with dedicated channels and role governance."
                  : "Launch the first public Orbit on ASTERIAL or invite members into a private community."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1">
              {tab === "joined" && orbits.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setTab("discover")}
                >
                  Browse Public Orbits
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Orbit
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredOrbits.map((orbit) => {
              const myMember = memberships[orbit.id];
              const isActiveMember = myMember?.status === "active";
              const isInvited = myMember?.status === "invited";

              return (
                <article
                  key={orbit.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={orbit.name}
                          avatarPath={orbit.icon_url}
                          size="lg"
                          isGroup
                        />
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-white truncate">
                            {orbit.name}
                          </h2>
                          <p className="font-mono text-[11px] text-zinc-500 truncate">
                            @{orbit.slug}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[var(--bg-elevated)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 shrink-0">
                        {orbit.visibility === "private" ? (
                          <>
                            <Lock className="h-2.5 w-2.5" />
                            Private
                          </>
                        ) : (
                          <>
                            <Globe className="h-2.5 w-2.5" />
                            Public
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 min-h-[2rem] leading-relaxed">
                      {orbit.description ||
                        "Community space with #announcements and #general channels."}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        {orbit.member_count}{" "}
                        {orbit.member_count === 1 ? "member" : "members"}
                      </span>
                      {isActiveMember && (
                        <span className="inline-flex items-center gap-1 text-zinc-200 uppercase">
                          <Check className="h-3 w-3" />
                          {myMember.role}
                        </span>
                      )}
                    </div>

                    {isActiveMember ? (
                      <Link
                        href={`/app/orbits/${orbit.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant={isInvited ? "primary" : "secondary"}
                        loading={joiningId === orbit.id}
                        onClick={() => void handleJoinOrbit(orbit)}
                      >
                        {isInvited ? "Accept Invite" : "Join Orbit"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Orbit Modal */}
      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Launch a new Orbit"
        description="Orbits include #announcements and #general channels, role governance, and public or invite-only membership."
      >
        <form onSubmit={handleCreateOrbit} className="space-y-4">
          {createError && (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
              {createError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Avatar
              name={draftName || "Orbit"}
              size="lg"
              isGroup
            />
            <div>
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-white/25 cursor-pointer">
                <Camera className="h-3.5 w-3.5" />
                <span>{iconFile ? iconFile.name : "Upload Orbit icon"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setIconFile(e.target.files?.[0] || null)}
                />
              </label>
              <p className="mt-1 text-[11px] text-zinc-500">
                PNG, JPG, WebP, or GIF up to 5 MB
              </p>
            </div>
          </div>

          <Input
            label="Orbit name"
            placeholder="e.g. Architecture & Systems"
            value={draftName}
            onChange={(e) => {
              const next = e.target.value;
              setDraftName(next);
              if (!slugTouched) {
                setDraftSlug(slugifyOrbitName(next));
              }
            }}
            maxLength={80}
            required
          />

          <Input
            label="Community handle"
            placeholder="architecture-systems"
            value={draftSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setDraftSlug(slugifyOrbitName(e.target.value));
            }}
            leftAddon={<Hash className="h-3.5 w-3.5" />}
            maxLength={36}
            required
          />

          <Textarea
            label="Purpose & guidelines"
            placeholder="Describe what members discuss and build here..."
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            maxLength={500}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Membership visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  [
                    "public",
                    "Public Orbit",
                    "Discoverable by any signed-in member",
                  ],
                  [
                    "private",
                    "Private Orbit",
                    "Visible & joinable by invitation only",
                  ],
                ] as const
              ).map(([val, title, desc]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDraftVisibility(val)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors cursor-pointer",
                    draftVisibility === val
                      ? "border-white bg-white/[0.08] text-white"
                      : "border-white/10 bg-[var(--bg-canvas)] text-zinc-400 hover:border-white/20"
                  )}
                >
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Launch Orbit
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
