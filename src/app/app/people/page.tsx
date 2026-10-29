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
import { MobileUtilityActions } from "@/components/workspace/WorkspaceShell";
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

type PeopleTab = "directory" | "orbit" | "recent";

export default function PeoplePage() {
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

  const [tab, setTab] = useState<PeopleTab>("directory");
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
    <div className="flex h-full flex-col overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                People
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Find people by @username, view profiles, start direct messages,
                or add close connections.
              </p>
            </div>
            <MobileUtilityActions />
          </div>

          <SegmentedControl<PeopleTab>
            ariaLabel="People view"
            value={tab}
            onChange={setTab}
            options={[
              { id: "directory", label: "Directory" },
              {
                id: "orbit",
                label: "Close Orbit",
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
            title="Could not load directory"
            message={error}
            onRetry={() => setPageSize((p) => p)}
          />
        ) : tab === "orbit" ? (
          filteredFavorites.length === 0 ? (
            <EmptyState
              icon={<Orbit className="h-5 w-5" />}
              title="No Close Orbit connections yet"
              description="Star any person in the directory to add them to your private Close Orbit for priority access and Orbit-only Moments."
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
                    className="flex flex-col justify-between rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
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
                          <p className="truncate text-xs text-[var(--text-muted)]">
                            @{fav.username} ·{" "}
                            {online
                              ? "Active now"
                              : formatLastSeen(fav.last_seen_at)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeCloseOrbit(fav.contact_id)}
                        title="Remove from Close Orbit"
                        aria-label="Remove from Close Orbit"
                        className="rounded-[9px] p-1.5 text-[var(--accent)] hover:bg-[var(--surface-hover)] cursor-pointer"
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
                        <span>Message</span>
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
              description="Direct conversations you open appear here for one-tap access."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentDirectPeers.map((c) => {
                const peer = c.peerProfile!;
                const online =
                  peer.presence_visibility !== "nobody" &&
                  onlineUserIds.has(peer.id);
                const inOrbit = closeOrbitMap.has(peer.id);
                return (
                  <div
                    key={c.conversation.id}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={c.displayTitle}
                        avatarPath={c.displayAvatarPath}
                        size="md"
                        online={online}
                        showPresence={peer.presence_visibility !== "nobody"}
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
                        <p className="truncate text-xs text-[var(--text-secondary)]">
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
                        className="rounded-[9px] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] cursor-pointer"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            inOrbit
                              ? "fill-[var(--accent)] text-[var(--accent)]"
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
                className="flex items-center gap-3 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
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
            title="No matching profiles found"
            description="Try searching by another @username or display name."
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
                    className="flex flex-col justify-between rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
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
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            {online
                              ? "Active"
                              : formatLastSeen(person.last_seen_at)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          @{person.username}
                        </p>
                        {person.status_text && (
                          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                            {person.status_text}
                          </p>
                        )}
                        {person.bio && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-muted)] leading-relaxed">
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
                            className="rounded-[9px] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                inOrbit
                                  ? "fill-[var(--accent)] text-[var(--accent)]"
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
                          className="rounded-[9px] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          {blocked ? (
                            <Check className="h-3.5 w-3.5 text-[var(--success)]" />
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
                          className="rounded-[9px] p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger)]/12 hover:text-[var(--danger)] transition-colors cursor-pointer"
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
                        <span>
                          {blocked
                            ? "Blocked"
                            : dmsClosed
                              ? "DMs closed"
                              : "Message"}
                        </span>
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
                  Load more profiles
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Preview Modal */}
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
                    ? "Active now"
                    : formatLastSeen(previewPerson.last_seen_at)}
                </p>
              </div>
            </div>

            {previewPerson.bio && (
              <p className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
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
                <span>
                  {closeOrbitMap.has(previewPerson.id)
                    ? "Remove from Orbit"
                    : "Add to Close Orbit"}
                </span>
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
                <span>Direct message</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
