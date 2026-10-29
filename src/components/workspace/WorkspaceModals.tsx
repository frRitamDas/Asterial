"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Compass,
  CornerUpRight,
  Flame,
  Loader2,
  MessageSquare,
  Orbit,
  Search,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import {
  contactsService,
  groupsService,
  mediaService,
  messagesService,
  searchService,
  type UnifiedSearchResults,
} from "@/lib/services";
import {
  groupCreateSchema,
  reportCreateSchema,
} from "@/lib/validation/schemas";
import { formatPresenceStatus, formatShortTime, isUserOnline } from "@/lib/utils/format";
import type {
  ReportCategory,
  UserSearchResult,
} from "@/lib/types/database";

export function WorkspaceModals() {
  const { activeModal, reportTarget, forwardingMessage } = useWorkspace();
  return (
    <>
      {activeModal === "new-dm" && <NewDirectMessageModal />}
      {activeModal === "new-group" && <NewGroupModal />}
      {activeModal === "search" && <UnifiedSearchModal />}
      {reportTarget && <ReportModal key={reportTarget.label} />}
      {forwardingMessage && (
        <ForwardMessageModal key={forwardingMessage.id} />
      )}
    </>
  );
}

function NewDirectMessageModal() {
  const router = useRouter();
  const {
    setActiveModal,
    startDirectConversation,
    onlineUserIds,
    closeOrbitMap,
  } = useWorkspace();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await contactsService.searchUsers(query, 24);
        if (active) {
          setResults(items);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load directory."
          );
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = async (target: UserSearchResult) => {
    setStartingUserId(target.id);
    const convId = await startDirectConversation(target.id);
    setStartingUserId(null);
    if (convId) {
      setActiveModal(null);
      router.push(`/app/chats/${convId}`);
    }
  };

  return (
    <Dialog
      open
      onClose={() => setActiveModal(null)}
      title="New direct message"
      description="Search by @username or display name. Private email addresses are never exposed."
    >
      <div className="space-y-4">
        <Input
          placeholder="Search @username or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
          autoFocus
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-[var(--text-muted)] gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching directory…
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-8 px-4 text-center text-xs text-[var(--text-muted)]">
              No matching people found.
            </div>
          ) : (
            results.map((person) => {
              const online =
                onlineUserIds.has(person.id) || isUserOnline(person.last_seen_at);
              const dmsDisabled =
                person.allow_direct_messages === "none" ||
                person.is_blocked_by_me;
              const inOrbit = closeOrbitMap.has(person.id);

              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 hover:border-[var(--border-strong)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={person.display_name}
                      avatarPath={person.avatar_url}
                      size="md"
                      online={online}
                      showPresence
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {person.display_name}
                        </p>
                        {inOrbit && (
                          <Badge variant="accent" size="sm">
                            Orbit
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-[var(--text-muted)] font-mono">
                        @{person.username} ·{" "}
                        {formatPresenceStatus(person.last_seen_at, online)}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={dmsDisabled ? "secondary" : "primary"}
                    disabled={dmsDisabled || startingUserId !== null}
                    loading={startingUserId === person.id}
                    onClick={() => handleSelect(person)}
                  >
                    {person.is_blocked_by_me
                      ? "Blocked"
                      : person.allow_direct_messages === "none"
                        ? "DMs closed"
                        : "Message"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}

function NewGroupModal() {
  const router = useRouter();
  const { user, setActiveModal, refreshConversations } = useWorkspace();
  const { pushToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const items = await contactsService.searchUsers(query, 20);
        if (active) {
          setCandidates(items.filter((u) => !u.is_blocked_by_me));
        }
      } catch {
        // Ignore transient directory errors while typing
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const uploaded = await mediaService.uploadAvatarFile(user.id, file, "group");
      setAvatarPath(uploaded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload group avatar."
      );
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleMember = (candidate: UserSearchResult) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === candidate.id)
        ? prev.filter((u) => u.id !== candidate.id)
        : [...prev, candidate]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = groupCreateSchema.safeParse({
      name,
      description,
      memberIds: selectedUsers.map((u) => u.id),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check group details.");
      return;
    }

    setCreating(true);
    try {
      const convId = await groupsService.createGroup({
        name: parsed.data.name,
        description: parsed.data.description,
        memberIds: parsed.data.memberIds,
        avatarUrl: avatarPath,
      });

      await refreshConversations();
      setActiveModal(null);
      pushToast({
        title: `Created "${parsed.data.name}"`,
        variant: "success",
      });
      router.push(`/app/chats/${convId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create group right now."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => setActiveModal(null)}
      title="Create a group"
      description="Assemble a role-governed space for your team, friends, or community."
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Avatar
            name={name || "GR"}
            avatarPath={avatarPath}
            size="lg"
            isGroup
          />
          <div className="flex-1">
            <Input
              label="Group name"
              placeholder="Orbital Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="pt-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleGroupAvatar}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              loading={uploadingAvatar}
              title="Upload group image"
              aria-label="Upload group image"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Input
          label="Description (optional)"
          placeholder="Purpose or topic of this group…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />

        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide text-[var(--text-secondary)]">
            Add members ({selectedUsers.length} selected)
          </label>
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-active)] bg-[var(--accent-signal-subtle)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  {u.display_name}
                  <button
                    type="button"
                    aria-label={`Remove ${u.display_name}`}
                    onClick={() => toggleMember(u)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Input
            placeholder="Filter people by @username or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftAddon={<Users className="h-4 w-4" />}
          />

          <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
            {candidates.length === 0 ? (
              <p className="py-5 text-center text-xs text-[var(--text-muted)]">
                No matching users found. You can still create the group and add
                members later.
              </p>
            ) : (
              candidates.map((c) => {
                const selected = selectedUsers.some((u) => u.id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleMember(c)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={c.display_name}
                        avatarPath={c.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {c.display_name}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                          @{c.username}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        selected
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]"
                          : "border-white/20"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveModal(null)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={creating}>
            Create group
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type SearchCategory =
  | "all"
  | "users"
  | "chats"
  | "groups"
  | "orbits"
  | "messages"
  | "moments"
  | "posts";

function UnifiedSearchModal() {
  const router = useRouter();
  const { setActiveModal, conversations, startDirectConversation } =
    useWorkspace();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [resultsState, setResultsState] = useState<{
    query: string;
    data: UnifiedSearchResults;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setError(null);
        const data = await searchService.unifiedSearch({
          query: trimmed,
          localConversations: conversations,
          limitPerSection: 12,
        });
        if (active) {
          setResultsState({ query: trimmed, data });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Search failed.");
        }
      }
    }, 240);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [conversations, trimmed]);

  const loading = trimmed.length >= 2 && resultsState?.query !== trimmed && !error;
  const data: UnifiedSearchResults = useMemo(() => {
    if (trimmed.length >= 2 && resultsState?.query === trimmed) {
      return resultsState.data;
    }
    return {
      users: [],
      conversations: [],
      groups: [],
      orbits: [],
      messages: [],
      moments: [],
      posts: [],
    };
  }, [resultsState, trimmed]);

  const totalMatches =
    data.users.length +
    data.conversations.length +
    data.groups.length +
    data.orbits.length +
    data.messages.length +
    data.moments.length +
    data.posts.length;

  const showSection = (sec: Exclude<SearchCategory, "all">) =>
    category === "all" || category === sec;

  return (
    <Dialog
      open
      onClose={() => setActiveModal(null)}
      title="Search ASTERIAL"
      description="Authorized search across Chats, Messages, People, Groups, Orbits, Moments, and Feed."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-3.5">
        <Input
          placeholder="Search chats, messages, people, groups, orbits, or feed…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
          autoFocus
        />

        <div className="overflow-x-auto pb-1">
          <SegmentedControl<SearchCategory>
            ariaLabel="Search categories"
            value={category}
            onChange={setCategory}
            options={[
              { id: "all", label: "All", badge: totalMatches },
              { id: "chats", label: "Chats", badge: data.conversations.length },
              { id: "messages", label: "Messages", badge: data.messages.length },
              { id: "users", label: "People", badge: data.users.length },
              { id: "groups", label: "Groups", badge: data.groups.length },
              { id: "orbits", label: "Orbits", badge: data.orbits.length },
              { id: "moments", label: "Moments", badge: data.moments.length },
              { id: "posts", label: "Feed", badge: data.posts.length },
            ]}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto space-y-4 pr-1">
          {trimmed.length < 2 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-10 px-4 text-center text-xs text-[var(--text-muted)]">
              Type at least 2 characters to search across your authorized
              workspace.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-[var(--text-muted)] gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching workspace…
            </div>
          ) : totalMatches === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-10 px-4 text-center text-xs text-[var(--text-muted)]">
              No authorized matches found for &ldquo;{trimmed}&rdquo;.
            </div>
          ) : (
            <>
              {/* Direct Chats */}
              {showSection("chats") && data.conversations.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Direct Conversations
                  </p>
                  {data.conversations.map((c) => (
                    <button
                      key={c.conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(`/app/chats/${c.conversation.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Avatar
                        name={c.displayTitle}
                        avatarPath={c.displayAvatarPath}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {c.displayTitle}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {c.displaySubtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Groups */}
              {showSection("groups") && data.groups.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Groups
                  </p>
                  {data.groups.map((g) => (
                    <button
                      key={g.conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(`/app/chats/${g.conversation.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Avatar
                        name={g.displayTitle}
                        avatarPath={g.displayAvatarPath}
                        size="sm"
                        isGroup
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {g.displayTitle}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {g.displaySubtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Orbits */}
              {showSection("orbits") && data.orbits.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Orbits
                  </p>
                  {data.orbits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(`/app/orbits/${o.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Avatar
                        name={o.name}
                        avatarPath={o.icon_url}
                        size="sm"
                        isGroup
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Orbit className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {o.name}
                          </p>
                        </div>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {o.description || `${o.member_count} members`}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* People */}
              {showSection("users") && data.users.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    People Directory
                  </p>
                  {data.users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={async () => {
                        if (
                          u.allow_direct_messages === "none" ||
                          u.is_blocked_by_me
                        ) {
                          setActiveModal(null);
                          router.push("/app/people");
                          return;
                        }
                        const convId = await startDirectConversation(u.id);
                        setActiveModal(null);
                        if (convId) router.push(`/app/chats/${convId}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Avatar
                        name={u.display_name}
                        avatarPath={u.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {u.display_name}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                          @{u.username}
                          {u.status_text ? ` · ${u.status_text}` : ""}
                        </p>
                      </div>
                      <Badge variant="neutral" size="sm">
                        {u.allow_direct_messages === "none"
                          ? "View"
                          : "Message"}
                      </Badge>
                    </button>
                  ))}
                </section>
              )}

              {/* Messages */}
              {showSection("messages") && data.messages.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Messages
                  </p>
                  {data.messages.map((m) => (
                    <button
                      key={m.message_id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(
                          `/app/chats/${m.conversation_id}?highlight=${m.message_id}`
                        );
                      }}
                      className="flex w-full items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {m.conversation_name || "Conversation"}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                            {formatShortTime(m.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          <span className="text-[var(--text-muted)]">
                            {m.sender_display_name || "Member"}:{" "}
                          </span>
                          {m.body}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Moments */}
              {showSection("moments") && data.moments.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Active Moments
                  </p>
                  {data.moments.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push("/app/moments");
                      }}
                      className="flex w-full items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Flame className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {m.author_display_name} (@{m.author_username})
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                            {formatShortTime(m.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {m.caption || "Shared a media Moment"}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Feed Posts */}
              {showSection("posts") && data.posts.length > 0 && (
                <section className="space-y-1.5">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Community Feed
                  </p>
                  {data.posts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push("/app/feed");
                      }}
                      className="flex w-full items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <Compass className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {p.author_display_name} (@{p.author_username})
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                            {formatShortTime(p.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {p.body}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ForwardMessageModal() {
  const router = useRouter();
  const {
    forwardingMessage,
    setForwardingMessage,
    conversations,
    refreshConversations,
  } = useWorkspace();
  const { pushToast } = useToast();

  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!forwardingMessage) return null;

  const availableConversations = conversations.filter((c) => {
    if (c.membership.left_at) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      c.displayTitle.toLowerCase().includes(q) ||
      c.displaySubtitle.toLowerCase().includes(q)
    );
  });

  const toggleTarget = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length >= 10
          ? prev
          : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setForwarding(true);
    setError(null);
    try {
      await messagesService.forwardMessage(forwardingMessage.id, selectedIds);
      await refreshConversations();
      setForwardingMessage(null);
      pushToast({
        title:
          selectedIds.length === 1
            ? "Message forwarded"
            : `Forwarded to ${selectedIds.length} conversations`,
        variant: "success",
      });
      if (selectedIds.length === 1) {
        router.push(`/app/chats/${selectedIds[0]}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to forward message."
      );
    } finally {
      setForwarding(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => setForwardingMessage(null)}
      title="Forward message"
      description="Select up to 10 conversations you belong to."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-primary)]">
            <CornerUpRight className="h-3.5 w-3.5" />
            <span>
              From{" "}
              {forwardingMessage.senderProfile?.display_name || "Conversation"}
            </span>
          </div>
          <p className="mt-1 line-clamp-3 text-xs text-[var(--text-secondary)]">
            {forwardingMessage.body.trim() || "Attachment message"}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <Input
          placeholder="Filter destination chats or groups…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
          autoFocus
        />

        <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
          {availableConversations.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--text-muted)]">
              No matching conversations.
            </p>
          ) : (
            availableConversations.map((c) => {
              const selected = selectedIds.includes(c.conversation.id);
              return (
                <button
                  key={c.conversation.id}
                  type="button"
                  onClick={() => toggleTarget(c.conversation.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
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
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      selected
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]"
                        : "border-white/20"
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--text-muted)]">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForwardingMessage(null)}
              disabled={forwarding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIds.length === 0}
              loading={forwarding}
              onClick={handleForward}
            >
              <CornerUpRight className="h-3.5 w-3.5" />
              Forward
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ReportModal() {
  const { reportTarget, closeReportModal, submitReport } = useWorkspace();
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setError(null);

    const parsed = reportCreateSchema.safeParse({ category, details });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid report details.");
      return;
    }

    setSubmitting(true);
    const ok = await submitReport({
      reportedUserId: reportTarget.reportedUserId,
      conversationId: reportTarget.conversationId,
      messageId: reportTarget.messageId,
      orbitId: reportTarget.orbitId,
      postId: reportTarget.postId,
      momentId: reportTarget.momentId,
      category: parsed.data.category,
      details: parsed.data.details,
    });
    setSubmitting(false);
    if (ok) {
      closeReportModal();
    }
  };

  return (
    <Dialog
      open={Boolean(reportTarget)}
      onClose={closeReportModal}
      title={`Report ${reportTarget?.label || "content"}`}
      description="Reports are logged securely for moderation review."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Reason
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["spam", "Spam"],
                ["harassment", "Harassment"],
                ["impersonation", "Impersonation"],
                ["illegal_content", "Unlawful content"],
                ["other", "Other"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setCategory(val)}
                className={`rounded-xl border px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                  category === val
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] font-medium"
                    : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Additional context (optional)"
          placeholder="Provide any relevant details…"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={closeReportModal}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
