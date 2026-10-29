"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  Edit3,
  Globe,
  Lock,
  MessageSquare,
  Orbit,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  CloseOrbitContactItem,
  CloseOrbitTier,
  OrbitMemberRow,
  OrbitRow,
  OrbitVisibility,
} from "@asterial/core";
import { orbitCreateSchema } from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { contactsService, mediaService, orbitsService } from "@/lib/services";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { MobileUtilityActions } from "@/components/workspace/WorkspaceShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input, Textarea } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatLastSeen, formatShortTime, isUserOnline } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { UserSearchResult } from "@/lib/types/database";

function slugifyOrbitName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 36);
}

type OrbitsMode = "close" | "spaces";
type CloseFilter = "all" | "inner" | "priority";

export default function OrbitsPage() {
  const router = useRouter();
  const {
    user,
    onlineUserIds,
    closeOrbitItems,
    closeOrbitMap,
    upsertCloseOrbit,
    removeCloseOrbit,
    startDirectConversation,
  } = useWorkspace();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<OrbitsMode>("close");
  const [closeFilter, setCloseFilter] = useState<CloseFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  // Add Close Connection Modal State
  const [addCloseOpen, setAddCloseOpen] = useState(false);
  const [dirQuery, setDirQuery] = useState("");
  const [dirResults, setDirResults] = useState<UserSearchResult[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<CloseOrbitTier>("inner");
  const [editingCloseItem, setEditingCloseItem] =
    useState<CloseOrbitContactItem | null>(null);
  const [editTier, setEditTier] = useState<CloseOrbitTier>("inner");
  const [editNote, setEditNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Community Spaces State
  const [orbits, setOrbits] = useState<OrbitRow[]>([]);
  const [memberships, setMemberships] = useState<Map<string, OrbitMemberRow>>(
    new Map()
  );
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [spacesTab, setSpacesTab] = useState<"joined" | "discover">("joined");
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

  const fetchSpaces = useCallback(async () => {
    if (!user?.id) return;
    setSpacesError(null);
    try {
      const res = await orbitsService.fetchCommunityOrbits(user.id);
      setOrbits(res.orbits);
      setMemberships(res.myMemberships);
    } catch (err) {
      setSpacesError(
        err instanceof Error ? err.message : "Could not load community spaces."
      );
    } finally {
      setSpacesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSpaces();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSpaces]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`web-orbits-dir-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orbits" },
        () => {
          void fetchSpaces();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchSpaces, user?.id]);

  // Directory search inside Add Close Contact dialog
  useEffect(() => {
    if (!addCloseOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setDirLoading(true);
      try {
        const items = await contactsService.searchUsers(dirQuery, 24);
        if (active) {
          setDirResults(items.filter((u) => !u.is_blocked_by_me));
          setDirLoading(false);
        }
      } catch {
        if (active) setDirLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [addCloseOpen, dirQuery]);

  const filteredCloseOrbit = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return closeOrbitItems.filter((item) => {
      if (closeFilter !== "all" && item.tier !== closeFilter) return false;
      if (!q) return true;
      return (
        item.display_name.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q)
      );
    });
  }, [closeFilter, closeOrbitItems, searchQuery]);

  const filteredSpaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orbits.filter((o) => {
      const mem = memberships.get(o.id);
      const isJoined = mem?.status === "active";
      if (spacesTab === "joined" && !isJoined) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    });
  }, [memberships, orbits, searchQuery, spacesTab]);

  const handleQuickChat = async (item: CloseOrbitContactItem) => {
    if (item.direct_conversation_id) {
      router.push(`/app/chats/${item.direct_conversation_id}`);
      return;
    }
    setStartingUserId(item.contact_id);
    const convId = await startDirectConversation(item.contact_id);
    setStartingUserId(null);
    if (convId) {
      router.push(`/app/chats/${convId}`);
    }
  };

  const handleSaveCloseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCloseItem) return;
    setSavingNote(true);
    const ok = await upsertCloseOrbit(
      editingCloseItem.contact_id,
      editTier,
      editNote
    );
    setSavingNote(false);
    if (ok) {
      setEditingCloseItem(null);
    }
  };

  const handleJoinSpace = async (orbit: OrbitRow) => {
    setJoiningId(orbit.id);
    try {
      await orbitsService.joinOrbit(orbit.id);
      await fetchSpaces();
      pushToast({ title: `Joined ${orbit.name}`, variant: "success" });
      router.push(`/app/orbits/${orbit.id}`);
    } catch (err) {
      pushToast({
        title: "Could not join space",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateError(null);
    const parsed = orbitCreateSchema.safeParse({
      name: draftName,
      slug: draftSlug,
      description: draftDesc,
      visibility: draftVisibility,
    });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message || "Invalid space details.");
      return;
    }

    setCreating(true);
    try {
      let iconUrl: string | null = null;
      if (iconFile) {
        iconUrl = await mediaService.uploadAvatarFile(
          user.id,
          iconFile,
          "orbit"
        );
      }
      const orbitId = await orbitsService.createOrbit({
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        visibility: parsed.data.visibility,
        iconUrl,
      });
      setCreateOpen(false);
      setDraftName("");
      setDraftSlug("");
      setDraftDesc("");
      setIconFile(null);
      await fetchSpaces();
      pushToast({ title: `Created ${parsed.data.name}`, variant: "success" });
      router.push(`/app/orbits/${orbitId}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create space."
      );
    } finally {
      setCreating(false);
    }
  };

  const innerCount = closeOrbitItems.filter((c) => c.tier === "inner").length;
  const priorityCount = closeOrbitItems.filter(
    (c) => c.tier === "priority"
  ).length;
  const joinedSpacesCount = Array.from(memberships.values()).filter(
    (m) => m.status === "active"
  ).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header & Primary Mode Switch */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Orbits
                </h1>
                <Badge variant="accent">Private &amp; Role-Governed</Badge>
              </div>
              <MobileUtilityActions />
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-secondary)]">
              {mode === "close"
                ? "Curate your private Inner Circle and Priority connections. Membership in your Close Orbit is strictly private to you and powers Orbit-only Moments and Feed posts."
                : "Collaborate inside structured multi-channel Community Spaces with real-time messaging and role moderation."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<OrbitsMode>
              ariaLabel="Orbits section"
              value={mode}
              onChange={setMode}
              options={[
                {
                  id: "close",
                  label: "Close Connections",
                  badge: closeOrbitItems.length,
                },
                {
                  id: "spaces",
                  label: "Community Spaces",
                  badge: joinedSpacesCount,
                },
              ]}
            />
            {mode === "close" ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setAddCloseOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add connection
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Create space
              </Button>
            )}
          </div>
        </div>

        {/* Search + Sub-filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <Input
              placeholder={
                mode === "close"
                  ? "Filter your Close Orbit by name, @username, or note…"
                  : "Search Community Spaces by name or handle…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
            />
          </div>

          {mode === "close" ? (
            <SegmentedControl<CloseFilter>
              ariaLabel="Orbit tier filter"
              value={closeFilter}
              onChange={setCloseFilter}
              options={[
                { id: "all", label: "All", badge: closeOrbitItems.length },
                { id: "inner", label: "Inner Circle", badge: innerCount },
                { id: "priority", label: "Priority", badge: priorityCount },
              ]}
            />
          ) : (
            <SegmentedControl<"joined" | "discover">
              ariaLabel="Spaces filter"
              value={spacesTab}
              onChange={setSpacesTab}
              options={[
                { id: "joined", label: "Joined", badge: joinedSpacesCount },
                { id: "discover", label: "Discover", badge: orbits.length },
              ]}
            />
          )}
        </div>

        {mode === "close" ? (
          <>
            {/* Privacy Guarantee Banner */}
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-secondary)]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
              <span>
                Your Close Orbit list and personal relationship notes are
                enforced by owner-only PostgreSQL Row Level Security (
                <code className="font-mono text-[11px] text-[var(--text-primary)]">
                  owner_id = auth.uid()
                </code>
                ). Contacts are never notified when added or removed.
              </span>
            </div>

            {filteredCloseOrbit.length === 0 ? (
              <EmptyState
                icon={<Orbit className="h-5 w-5" />}
                title={
                  closeOrbitItems.length === 0
                    ? "Your Close Orbit is empty"
                    : "No close connections match this filter"
                }
                description="Add trusted friends, teammates, or family to prioritize their conversations, see live presence when permitted, and share Orbit-only Moments."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setAddCloseOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add close connection
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {filteredCloseOrbit.map((item) => {
                  const online =
                    onlineUserIds.has(item.contact_id) ||
                    isUserOnline(item.last_seen_at);

                  return (
                    <div
                      key={item.contact_id}
                      className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={item.display_name}
                              avatarPath={item.avatar_url}
                              size="lg"
                              online={online}
                              showPresence
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {item.display_name}
                                </h2>
                                <Badge
                                  variant={
                                    item.tier === "inner" ? "accent" : "neutral"
                                  }
                                  size="sm"
                                >
                                  {item.tier === "inner"
                                    ? "Inner Circle"
                                    : "Priority"}
                                </Badge>
                              </div>
                              <p className="truncate font-mono text-xs text-[var(--text-muted)]">
                                @{item.username} ·{" "}
                                {online
                                  ? "Online now"
                                  : formatLastSeen(item.last_seen_at)}
                              </p>
                            </div>
                          </div>

                          {item.unread_count > 0 && (
                            <Badge variant="accent" size="md">
                              {item.unread_count} unread
                            </Badge>
                          )}
                        </div>

                        {item.note ? (
                          <p className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                              Private note
                            </span>
                            {item.note}
                          </p>
                        ) : item.status_text || item.bio ? (
                          <p className="mt-3 line-clamp-2 text-xs text-[var(--text-secondary)]">
                            {item.status_text || item.bio}
                          </p>
                        ) : null}

                        {item.last_message_preview && (
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                            <span className="truncate">
                              Last chat: {item.last_message_preview}
                            </span>
                            {item.last_interaction_at && (
                              <span className="shrink-0 font-mono text-[10px]">
                                {formatShortTime(item.last_interaction_at)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCloseItem(item);
                              setEditTier(item.tier);
                              setEditNote(item.note || "");
                            }}
                            title="Edit Orbit tier or private note"
                            aria-label={`Edit ${item.display_name}`}
                            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeCloseOrbit(item.contact_id)}
                            title="Remove from Close Orbit"
                            aria-label={`Remove ${item.display_name} from Close Orbit`}
                            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          variant="primary"
                          loading={startingUserId === item.contact_id}
                          onClick={() => void handleQuickChat(item)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Quick Chat
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : spacesError ? (
          <ErrorState
            title="Could not load Community Spaces"
            message={spacesError}
            onRetry={() => void fetchSpaces()}
          />
        ) : spacesLoading ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filteredSpaces.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={
              spacesTab === "joined"
                ? "You haven’t joined any Community Spaces yet"
                : "No Community Spaces found"
            }
            description="Create a structured channel space for your community or switch to Discover to join public spaces."
            action={
              spacesTab === "joined" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSpacesTab("discover")}
                  >
                    Discover public spaces
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create space
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create space
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {filteredSpaces.map((orbit) => {
              const mem = memberships.get(orbit.id);
              const isJoined = mem?.status === "active";

              return (
                <div
                  key={orbit.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={orbit.name}
                          avatarPath={orbit.icon_url}
                          size="lg"
                          isGroup
                        />
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {orbit.name}
                          </h2>
                          <p className="truncate font-mono text-xs text-[var(--text-muted)]">
                            /{orbit.slug}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          orbit.visibility === "private" ? "neutral" : "accent"
                        }
                        size="sm"
                      >
                        {orbit.visibility === "private" ? (
                          <Lock className="h-2.5 w-2.5" />
                        ) : (
                          <Globe className="h-2.5 w-2.5" />
                        )}
                        {orbit.visibility}
                      </Badge>
                    </div>

                    {orbit.description && (
                      <p className="mt-3 line-clamp-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                        {orbit.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
                      <Users className="h-3.5 w-3.5" />
                      {orbit.member_count}{" "}
                      {orbit.member_count === 1 ? "member" : "members"}
                    </span>

                    {isJoined ? (
                      <Link
                        href={`/app/orbits/${orbit.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-medium text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] transition-colors"
                      >
                        Open channels
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={joiningId === orbit.id}
                        onClick={() => void handleJoinSpace(orbit)}
                      >
                        Join space
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Close Orbit Connection Modal */}
      {addCloseOpen && (
        <Dialog
          open
          onClose={() => setAddCloseOpen(false)}
          title="Add to Close Orbit"
          description="People in your Close Orbit stay private to you and can view your Orbit-only Moments and Feed posts."
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Relationship tier
              </span>
              <SegmentedControl<CloseOrbitTier>
                ariaLabel="Select tier"
                value={selectedTier}
                onChange={setSelectedTier}
                options={[
                  { id: "inner", label: "Inner Circle" },
                  { id: "priority", label: "Priority" },
                ]}
              />
            </div>

            <Input
              placeholder="Search people by @username or name…"
              value={dirQuery}
              onChange={(e) => setDirQuery(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {dirLoading ? (
                <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                  Searching directory…
                </p>
              ) : dirResults.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No matching people found.
                </p>
              ) : (
                dirResults.map((u) => {
                  const existing = closeOrbitMap.get(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={u.display_name}
                          avatarPath={u.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {u.display_name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                            @{u.username}
                          </p>
                        </div>
                      </div>
                      {existing ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void removeCloseOrbit(u.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Added ({existing.tier})
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            void upsertCloseOrbit(u.id, selectedTier)
                          }
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit Close Orbit Tier & Private Note Modal */}
      {editingCloseItem && (
        <Dialog
          open
          onClose={() => setEditingCloseItem(null)}
          title={`Edit ${editingCloseItem.display_name}`}
          description="Update tier or save a private personal note visible only to you."
        >
          <form onSubmit={handleSaveCloseEdit} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tier
              </span>
              <SegmentedControl<CloseOrbitTier>
                ariaLabel="Tier"
                value={editTier}
                onChange={setEditTier}
                options={[
                  { id: "inner", label: "Inner Circle" },
                  { id: "priority", label: "Priority" },
                ]}
              />
            </div>

            <Textarea
              label="Private note (only visible to you)"
              placeholder="Core collaborator, family, emergency contact…"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              maxLength={160}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingCloseItem(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={savingNote}>
                Save
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Create Community Space Modal */}
      {createOpen && (
        <Dialog
          open
          onClose={() => setCreateOpen(false)}
          title="Create a Community Space"
          description="Launch a multi-channel Orbit space with #general and #announcements."
        >
          <form onSubmit={handleCreateSpace} className="space-y-4">
            {createError && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                {createError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  label="Space name"
                  placeholder="Asterial Builders"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (!slugTouched) {
                      setDraftSlug(slugifyOrbitName(e.target.value));
                    }
                  }}
                  maxLength={80}
                  required
                />
              </div>
              <label className="mt-5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <Input
              label="Space handle"
              placeholder="asterial-builders"
              value={draftSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setDraftSlug(slugifyOrbitName(e.target.value));
              }}
              maxLength={36}
              required
            />

            <Textarea
              label="Description"
              placeholder="What brings people into this space?"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              maxLength={500}
            />

            <div className="grid grid-cols-2 gap-2">
              {(["public", "private"] as const).map((vis) => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => setDraftVisibility(vis)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs transition-colors cursor-pointer",
                    draftVisibility === vis
                      ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)] text-[var(--text-primary)] font-medium"
                      : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                  )}
                >
                  <span className="capitalize block font-semibold">{vis}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {vis === "public"
                      ? "Discoverable by signed-in members"
                      : "Invite-only space"}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={creating}>
                Create space
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
