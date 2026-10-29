"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Flag,
  MessageSquare,
  Orbit,
  Search,
  Star,
  UserPlus,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { contactsService } from "@/lib/services";
import { formatLastSeen, isUserOnline } from "@/lib/utils/format";
import type { UserSearchResult } from "@/lib/types/database";

type ContactsTab = "directory" | "favorites" | "recent";

export default function ContactsDiscoverPage() {
  const router = useRouter();
  const {
    conversations,
    onlineUserIds,
    closeOrbitItems,
    closeOrbitMap,
    upsertCloseOrbit,
    removeCloseOrbit,
    startDirectConversation,
    blockUser,
    unblockUser,
    isBlockedByMe,
    openReportModal,
  } = useWorkspace();

  const [tab, setTab] = useState<ContactsTab>("directory");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(24);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [previewPerson, setPreviewPerson] = useState<UserSearchResult | null>(
    null
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await contactsService.searchUsers(query, pageSize + 1);
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
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pageSize, query]);

  const hasMoreDirectory = results.length > pageSize;
  const visibleDirectory = hasMoreDirectory
    ? results.slice(0, pageSize)
    : results;

  const recentDirectPeers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => c.conversation.type === "direct" && c.peerProfile)
      .filter((c) => {
        if (!q) return true;
        return (
          c.displayTitle.toLowerCase().includes(q) ||
          c.displaySubtitle.toLowerCase().includes(q)
        );
      });
  }, [conversations, query]);

  const filteredFavorites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return closeOrbitItems.filter((item) => {
      if (!q) return true;
      return (
        item.display_name.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q)
      );
    });
  }, [closeOrbitItems, query]);

  const handleMessage = async (targetId: string) => {
    setStartingId(targetId);
    const convId = await startDirectConversation(targetId);
    setStartingId(null);
    if (convId) {
      setPreviewPerson(null);
      router.push(`/app/chats/${convId}`);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Contacts &amp; Discover
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Search people by @username or display name, manage favorite Orbit
              contacts, and jump into direct threads. Private email addresses
              are never exposed.
            </p>
          </div>
          <SegmentedControl<ContactsTab>
            ariaLabel="Contacts view"
            value={tab}
            onChange={setTab}
            options={[
              { id: "directory", label: "Directory" },
              {
                id: "favorites",
                label: "Favorites",
                badge: closeOrbitItems.length,
              },
              {
                id: "recent",
                label: "Recent",
                badge: recentDirectPeers.length,
              },
            ]}
          />
        </div>

        <Input
          placeholder="Search by @username or display name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPageSize(24);
          }}
          leftAddon={<Search className="h-4 w-4" />}
        />

        {error ? (
          <ErrorState
            title="Could not load contacts"
            message={error}
            onRetry={() => setPageSize((p) => p)}
          />
        ) : tab === "favorites" ? (
          filteredFavorites.length === 0 ? (
            <EmptyState
              icon={<Orbit className="h-5 w-5" />}
              title="No favorite Orbit contacts yet"
              description="Star any contact in the directory to add them to your private Close Orbit for priority access and Orbit-only Moments."
              action={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setTab("directory")}
                >
                  Browse directory
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredFavorites.map((fav) => {
                const online =
                  onlineUserIds.has(fav.contact_id) ||
                  isUserOnline(fav.last_seen_at);
                return (
                  <div
                    key={fav.contact_id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={fav.display_name}
                          avatarPath={fav.avatar_url}
                          size="lg"
                          online={online}
                          showPresence
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {fav.display_name}
                            </p>
                            <Badge variant="accent" size="sm">
                              {fav.tier === "inner" ? "Inner" : "Priority"}
                            </Badge>
                          </div>
                          <p className="truncate font-mono text-xs text-[var(--text-muted)]">
                            @{fav.username} ·{" "}
                            {online
                              ? "Online now"
                              : formatLastSeen(fav.last_seen_at)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeCloseOrbit(fav.contact_id)}
                        title="Remove from Favorites / Close Orbit"
                        aria-label="Remove from Favorites"
                        className="rounded-lg p-1.5 text-[var(--accent-primary)] hover:bg-white/[0.06] cursor-pointer"
                      >
                        <Star className="h-4 w-4 fill-current" />
                      </button>
                    </div>

                    {(fav.note || fav.bio) && (
                      <p className="mt-3 line-clamp-2 text-xs text-[var(--text-secondary)]">
                        {fav.note || fav.bio}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={startingId === fav.contact_id}
                        onClick={() => void handleMessage(fav.contact_id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "recent" ? (
          recentDirectPeers.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="No recent direct contacts"
              description="Direct conversations you open will appear here for fast one-tap access."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentDirectPeers.map((c) => {
                const peer = c.peerProfile!;
                const online = onlineUserIds.has(peer.id);
                const inOrbit = closeOrbitMap.has(peer.id);
                return (
                  <div
                    key={c.conversation.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={c.displayTitle}
                        avatarPath={c.displayAvatarPath}
                        size="md"
                        online={online}
                        showPresence
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {c.displayTitle}
                          </p>
                          {inOrbit && (
                            <Badge variant="accent" size="sm">
                              Orbit
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {c.conversation.last_message_preview ||
                            `@${peer.username}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          inOrbit
                            ? void removeCloseOrbit(peer.id)
                            : void upsertCloseOrbit(peer.id, "inner")
                        }
                        title={
                          inOrbit
                            ? "Remove from Close Orbit"
                            : "Add to Close Orbit"
                        }
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--accent-primary)] cursor-pointer"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            inOrbit
                              ? "fill-[var(--accent-primary)] text-[var(--accent-primary)]"
                              : ""
                          }`}
                        />
                      </button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          router.push(`/app/chats/${c.conversation.id}`)
                        }
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleDirectory.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="No matching accounts found"
            description="Try searching by a different @username or display name."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleDirectory.map((person) => {
                const online =
                  onlineUserIds.has(person.id) ||
                  isUserOnline(person.last_seen_at);
                const blocked =
                  isBlockedByMe(person.id) || person.is_blocked_by_me;
                const dmsClosed = person.allow_direct_messages === "none";
                const inOrbit = closeOrbitMap.has(person.id);

                return (
                  <div
                    key={person.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                  >
                    <div
                      onClick={() => setPreviewPerson(person)}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <Avatar
                        name={person.display_name}
                        avatarPath={person.avatar_url}
                        size="lg"
                        online={online}
                        showPresence
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {person.display_name}
                            </h2>
                            {inOrbit && (
                              <Badge variant="accent" size="sm">
                                Orbit
                              </Badge>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                            {online
                              ? "Online"
                              : formatLastSeen(person.last_seen_at)}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-[var(--text-muted)]">
                          @{person.username}
                        </p>
                        {person.status_text && (
                          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                            {person.status_text}
                          </p>
                        )}
                        {person.bio && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                            {person.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex items-center gap-1">
                        {!blocked && (
                          <button
                            type="button"
                            onClick={() =>
                              inOrbit
                                ? void removeCloseOrbit(person.id)
                                : void upsertCloseOrbit(person.id, "inner")
                            }
                            title={
                              inOrbit
                                ? "Remove from Close Orbit"
                                : "Add to Close Orbit"
                            }
                            aria-label={
                              inOrbit
                                ? `Remove ${person.display_name} from Close Orbit`
                                : `Add ${person.display_name} to Close Orbit`
                            }
                            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                inOrbit
                                  ? "fill-[var(--accent-primary)] text-[var(--accent-primary)]"
                                  : ""
                              }`}
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            blocked
                              ? void unblockUser(person.id)
                              : void blockUser(person.id)
                          }
                          title={blocked ? "Unblock user" : "Block user"}
                          aria-label={
                            blocked
                              ? `Unblock ${person.display_name}`
                              : `Block ${person.display_name}`
                          }
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          {blocked ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openReportModal({
                              reportedUserId: person.id,
                              label: `@${person.username}`,
                            })
                          }
                          title="Report user"
                          aria-label={`Report ${person.display_name}`}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Button
                        size="sm"
                        variant={blocked || dmsClosed ? "secondary" : "primary"}
                        disabled={blocked || dmsClosed || startingId !== null}
                        loading={startingId === person.id}
                        onClick={() => void handleMessage(person.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {blocked
                          ? "Blocked"
                          : dmsClosed
                            ? "DMs closed"
                            : "Message"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreDirectory && (
              <div className="flex justify-center pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPageSize((prev) => prev + 24)}
                >
                  Load more contacts
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact Profile Preview Modal */}
      {previewPerson && (
        <Dialog
          open
          onClose={() => setPreviewPerson(null)}
          title={previewPerson.display_name}
          description={`@${previewPerson.username}`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={previewPerson.display_name}
                avatarPath={previewPerson.avatar_url}
                size="xl"
                online={
                  onlineUserIds.has(previewPerson.id) ||
                  isUserOnline(previewPerson.last_seen_at)
                }
                showPresence
              />
              <div className="min-w-0 space-y-1">
                {previewPerson.status_text && (
                  <Badge variant="neutral" size="md">
                    {previewPerson.status_text}
                  </Badge>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  {onlineUserIds.has(previewPerson.id)
                    ? "Online now"
                    : formatLastSeen(previewPerson.last_seen_at)}
                </p>
              </div>
            </div>

            {previewPerson.bio && (
              <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                {previewPerson.bio}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  closeOrbitMap.has(previewPerson.id)
                    ? void removeCloseOrbit(previewPerson.id)
                    : void upsertCloseOrbit(previewPerson.id, "inner")
                }
              >
                <Orbit className="h-3.5 w-3.5" />
                {closeOrbitMap.has(previewPerson.id)
                  ? "Remove from Orbit"
                  : "Add to Close Orbit"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={
                  previewPerson.allow_direct_messages === "none" ||
                  isBlockedByMe(previewPerson.id)
                }
                loading={startingId === previewPerson.id}
                onClick={() => void handleMessage(previewPerson.id)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Direct message
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
