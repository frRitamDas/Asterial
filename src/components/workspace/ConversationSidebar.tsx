"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Orbit,
  Paperclip,
  Pin,
  PinOff,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ProfileMenuTrigger } from "@/components/workspace/WorkspaceShell";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { contactsService, searchService } from "@/lib/services";
import type {
  MessageSearchResult,
  UserSearchResult,
} from "@/lib/types/database";
import { formatShortTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type SidebarFilter = "all" | "unread" | "direct" | "groups" | "archived";

export function ConversationSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    conversations,
    preferences,
    onlineUserIds,
    closeOrbitMap,
    drafts,
    loadingInitial,
    setActiveModal,
    togglePin,
    toggleMute,
    toggleArchive,
    markConversationRead,
    startDirectConversation,
  } = useWorkspace();

  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Debounced server search across usernames and messages
  const [searchingServer, setSearchingServer] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [matchedUsers, setMatchedUsers] = useState<UserSearchResult[]>([]);
  const [matchedMessages, setMatchedMessages] = useState<MessageSearchResult[]>(
    []
  );
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (
        headerMenuRef.current &&
        !headerMenuRef.current.contains(event.target as Node)
      ) {
        setHeaderMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [headerMenuOpen]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setMatchedUsers([]);
        setMatchedMessages([]);
        setSearchError(null);
        setSearchingServer(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchingServer(true);
      setSearchError(null);
      try {
        const [usersRes, msgsRes] = await Promise.all([
          contactsService.searchUsers(trimmed, 6),
          searchService.searchMessages(trimmed, null, 8),
        ]);
        if (!active) return;
        setMatchedUsers(usersRes);
        setMatchedMessages(msgsRes);
      } catch (err) {
        if (!active) return;
        setSearchError(
          err instanceof Error ? err.message : "Search temporarily unavailable."
        );
      } finally {
        if (active) setSearchingServer(false);
      }
    }, 240);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const unreadConversations = useMemo(
    () =>
      conversations.filter(
        (c) => !c.membership.archived && c.membership.unread_count > 0
      ),
    [conversations]
  );

  const archivedCount = useMemo(
    () => conversations.filter((c) => c.membership.archived).length,
    [conversations]
  );

  const conversationMap = useMemo(() => {
    const map = new Map<string, (typeof conversations)[number]>();
    for (const c of conversations) {
      map.set(c.conversation.id, c);
    }
    return map;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((item) => {
      if (filter === "archived") {
        if (!item.membership.archived) return false;
      } else {
        if (item.membership.archived) return false;
        if (filter === "unread" && item.membership.unread_count <= 0)
          return false;
        if (filter === "direct" && item.conversation.type !== "direct")
          return false;
        if (filter === "groups" && item.conversation.type !== "group")
          return false;
      }

      if (!q) return true;
      return (
        item.displayTitle.toLowerCase().includes(q) ||
        item.displaySubtitle.toLowerCase().includes(q) ||
        (item.conversation.last_message_preview || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, searchQuery]);

  const previewsEnabled = preferences?.message_preview !== false;

  const handleMarkAllRead = async () => {
    setHeaderMenuOpen(false);
    await Promise.all(
      unreadConversations.map((c) => markConversationRead(c.conversation.id))
    );
  };

  const handleOpenUserDm = async (targetUserId: string) => {
    setStartingUserId(targetUserId);
    const convId = await startDirectConversation(targetUserId);
    setStartingUserId(null);
    if (convId) {
      setSearchQuery("");
      router.push(`/app/chats/${convId}`);
    }
  };

  const renderEmptyState = () => {
    if (searchQuery.trim()) {
      return (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            No matching conversations
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            Try another name or @username, or open global search across Moments
            and Feed.
          </p>
          <button
            type="button"
            onClick={() => setActiveModal("search")}
            className="mt-3.5 inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search entire workspace</span>
          </button>
        </div>
      );
    }

    const emptyCopy: Record<
      SidebarFilter,
      { title: string; body: string; ctaLabel?: string; onCta?: () => void }
    > = {
      all: {
        title: "No conversations yet",
        body: "Start a direct message by @username or create a group space.",
        ctaLabel: "New direct message",
        onCta: () => setActiveModal("new-dm"),
      },
      unread: {
        title: "All caught up",
        body: "You have zero unread direct messages or group updates.",
      },
      direct: {
        title: "No direct messages yet",
        body: "Find someone by @username to open a private 1:1 thread.",
        ctaLabel: "Start direct message",
        onCta: () => setActiveModal("new-dm"),
      },
      groups: {
        title: "No group chats yet",
        body: "Create a group to coordinate with teammates, friends, or study circles.",
        ctaLabel: "Create group",
        onCta: () => setActiveModal("new-group"),
      },
      archived: {
        title: "No archived chats",
        body: "Archive inactive threads to keep your main Chats list focused.",
      },
    };

    const current = emptyCopy[filter];
    return (
      <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
        <p className="text-xs font-semibold text-[var(--text-primary)]">
          {current.title}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed max-w-[240px]">
          {current.body}
        </p>
        {current.ctaLabel && current.onCta && (
          <button
            type="button"
            onClick={current.onCta}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--accent)] px-3 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>{current.ctaLabel}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <aside
      aria-label="Conversations"
      className={cn(
        "flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)]",
        className
      )}
    >
      {/* Compact Header */}
      <div className="flex h-14 items-center justify-between gap-2 px-4 shrink-0">
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Chats
        </h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveModal("search")}
            title="Global Search (⌘K)"
            aria-label="Global Search"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("new-dm")}
            title="New direct message"
            aria-label="New direct message"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("new-group")}
            title="Create group"
            aria-label="Create group"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Users className="h-4 w-4" />
          </button>

          {/* Overflow Menu */}
          <div ref={headerMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              title="More options"
              aria-label="Chat list options"
              aria-expanded={headerMenuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {headerMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1 shadow-2xl animate-asterial-in"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={unreadConversations.length === 0}
                  onClick={() => void handleMarkAllRead()}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>Mark all as read</span>
                </button>
                <Link
                  href="/app/groups"
                  role="menuitem"
                  onClick={() => setHeaderMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Users className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>Manage groups</span>
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setFilter("archived");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>Archived chats ({archivedCount})</span>
                </button>
                <Link
                  href="/app/settings/chat"
                  role="menuitem"
                  onClick={() => setHeaderMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Settings2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>Chat settings</span>
                </Link>
              </div>
            )}
          </div>

          <div className="md:hidden ml-0.5">
            <ProfileMenuTrigger align="top-right" size="xs" />
          </div>
        </div>
      </div>

      {/* Debounced Search Input */}
      <div className="px-3.5 pb-2.5 shrink-0">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats, @usernames, or messages…"
            aria-label="Search chats, usernames, or messages"
            className="h-9 w-full rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] pl-8.5 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 rounded-[6px] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Filter Chips */}
      <div
        role="tablist"
        aria-label="Conversation filters"
        className="flex items-center gap-1.5 overflow-x-auto px-3.5 pb-2.5 no-scrollbar shrink-0"
      >
        {(
          [
            ["all", "All"],
            [
              "unread",
              unreadConversations.length > 0
                ? `Unread (${unreadConversations.length})`
                : "Unread",
            ],
            ["direct", "Direct"],
            ["groups", "Groups"],
            [
              "archived",
              archivedCount > 0 ? `Archived (${archivedCount})` : "Archived",
            ],
          ] as const
        ).map(([id, label]) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(id)}
              className={cn(
                "shrink-0 rounded-[9px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                active
                  ? "bg-[var(--accent)] text-[var(--accent-primary-fg)]"
                  : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Independent Scrollable List */}
      <div
        className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5"
        onClick={() => {
          if (openMenuId) setOpenMenuId(null);
        }}
      >
        {loadingInitial ? (
          <div className="space-y-1 p-2" aria-label="Loading conversations">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredConversations.length === 0 &&
            matchedUsers.length === 0 &&
            matchedMessages.length === 0 &&
            !searchingServer
              ? renderEmptyState()
              : filteredConversations.map((item) => {
                  const href = `/app/chats/${item.conversation.id}`;
                  const isActive = pathname === href;
                  const canShowOnline =
                    item.conversation.type === "direct" &&
                    item.peerProfile?.presence_visibility !== "nobody";
                  const isPeerOnline =
                    canShowOnline &&
                    Boolean(
                      item.peerProfile && onlineUserIds.has(item.peerProfile.id)
                    );
                  const inCloseOrbit =
                    item.conversation.type === "direct" &&
                    Boolean(
                      item.peerProfile && closeOrbitMap.has(item.peerProfile.id)
                    );
                  const draftText = drafts[item.conversation.id]?.trim();
                  const unread = item.membership.unread_count;
                  const menuOpen = openMenuId === item.conversation.id;
                  const rawPreview = item.conversation.last_message_preview || "";
                  const hasAttachmentHint =
                    /^\[.*\]|^Sent |attachment|image|photo|video|voice|audio|file/i.test(
                      rawPreview
                    );

                  return (
                    <div
                      key={item.conversation.id}
                      className="relative group"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setOpenMenuId(item.conversation.id);
                      }}
                      onTouchStart={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current);
                        }
                        longPressTimerRef.current = window.setTimeout(() => {
                          setOpenMenuId(item.conversation.id);
                        }, 460);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                    >
                      <Link
                        href={href}
                        className={cn(
                          "flex min-h-[72px] items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition-colors",
                          isActive
                            ? "bg-[var(--accent-signal-subtle)] border border-[var(--border-active)]"
                            : "border border-transparent hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        <Avatar
                          name={item.displayTitle}
                          avatarPath={item.displayAvatarPath}
                          size="lg"
                          isGroup={item.conversation.type === "group"}
                          online={isPeerOnline}
                          showPresence={canShowOnline}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={cn(
                                  "truncate text-[14px] leading-snug",
                                  unread > 0
                                    ? "font-semibold text-[var(--text-primary)]"
                                    : "font-medium text-[var(--text-primary)]"
                                )}
                              >
                                {item.displayTitle}
                              </span>
                              {inCloseOrbit && (
                                <Orbit
                                  className="h-3 w-3 shrink-0 text-[var(--accent)]"
                                  aria-label="In Close Orbit"
                                />
                              )}
                              {item.membership.pinned && (
                                <Pin
                                  className="h-3 w-3 shrink-0 text-[var(--text-muted)]"
                                  aria-label="Pinned"
                                />
                              )}
                              {item.membership.is_muted && (
                                <BellOff
                                  className="h-3 w-3 shrink-0 text-[var(--text-muted)]"
                                  aria-label="Muted"
                                />
                              )}
                            </div>

                            <span
                              className={cn(
                                "shrink-0 text-[11px] transition-opacity md:group-hover:opacity-0",
                                unread > 0
                                  ? "font-medium text-[var(--accent)]"
                                  : "text-[var(--text-muted)]"
                              )}
                            >
                              {formatShortTime(
                                item.conversation.last_message_at ||
                                  item.conversation.created_at
                              )}
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            {draftText ? (
                              <p className="truncate text-xs">
                                <span className="font-medium text-[var(--accent)]">
                                  Draft:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  {draftText}
                                </span>
                              </p>
                            ) : !previewsEnabled && rawPreview ? (
                              <p className="truncate text-xs italic text-[var(--text-muted)]">
                                {unread > 0 ? "New message" : "Message"}
                              </p>
                            ) : (
                              <p
                                className={cn(
                                  "flex items-center gap-1 truncate text-xs",
                                  unread > 0
                                    ? "font-medium text-[var(--text-primary)]"
                                    : "text-[var(--text-secondary)]"
                                )}
                              >
                                {hasAttachmentHint && (
                                  <Paperclip className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                                )}
                                <span className="truncate">
                                  {rawPreview || "No messages yet"}
                                </span>
                              </p>
                            )}

                            {unread > 0 && (
                              <span
                                className={cn(
                                  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                  item.membership.is_muted
                                    ? "bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                                    : "bg-[var(--accent)] text-[var(--accent-primary-fg)]"
                                )}
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Desktop Hover / Mobile Quick Action Trigger */}
                      <button
                        type="button"
                        aria-label={`Actions for ${item.displayTitle}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuId((prev) =>
                            prev === item.conversation.id
                              ? null
                              : item.conversation.id
                          );
                        }}
                        className={cn(
                          "absolute right-2.5 top-2.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity cursor-pointer",
                          menuOpen
                            ? "opacity-100"
                            : "opacity-0 focus:opacity-100 md:group-hover:opacity-100"
                        )}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {menuOpen && (
                        <div
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-10 z-30 w-48 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1 shadow-2xl animate-asterial-in"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              void togglePin(
                                item.conversation.id,
                                !item.membership.pinned
                              );
                            }}
                            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                          >
                            {item.membership.pinned ? (
                              <>
                                <PinOff className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Unpin chat</span>
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Pin chat</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              void toggleMute(
                                item.conversation.id,
                                !item.membership.is_muted
                              );
                            }}
                            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                          >
                            {item.membership.is_muted ? (
                              <>
                                <Bell className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Unmute notifications</span>
                              </>
                            ) : (
                              <>
                                <BellOff className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Mute notifications</span>
                              </>
                            )}
                          </button>

                          {unread > 0 && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                void markConversationRead(item.conversation.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                            >
                              <CheckCheck className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                              <span>Mark as read</span>
                            </button>
                          )}

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              void toggleArchive(
                                item.conversation.id,
                                !item.membership.archived
                              );
                            }}
                            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                          >
                            {item.membership.archived ? (
                              <>
                                <ArchiveRestore className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Unarchive chat</span>
                              </>
                            ) : (
                              <>
                                <Archive className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                                <span>Archive chat</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

            {/* Debounced Server Search Results (People & Messages) */}
            {searchQuery.trim().length >= 2 && (
              <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] px-1.5 pt-3 pb-2">
                {searchingServer && (
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--text-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Searching usernames & messages…</span>
                  </div>
                )}

                {searchError && (
                  <div className="flex items-center gap-2 rounded-[10px] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2.5 py-2 text-xs text-[var(--danger)]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}

                {matchedUsers.length > 0 && (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      People
                    </p>
                    <div className="space-y-0.5">
                      {matchedUsers.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          disabled={startingUserId === person.id}
                          onClick={() => void handleOpenUserDm(person.id)}
                          className="flex w-full items-center justify-between gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={person.display_name}
                              avatarPath={person.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                                {person.display_name}
                              </p>
                              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                                @{person.username}
                              </p>
                            </div>
                          </div>
                          {startingUserId === person.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {matchedMessages.length > 0 && (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Messages
                    </p>
                    <div className="space-y-0.5">
                      {matchedMessages.map((msg) => {
                        const conv = conversationMap.get(msg.conversation_id);
                        return (
                          <Link
                            key={msg.message_id}
                            href={`/app/chats/${msg.conversation_id}?highlight=${msg.message_id}`}
                            className="block rounded-[10px] px-2.5 py-2 hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                                {conv?.displayTitle || "Conversation"}
                              </span>
                              <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                {formatShortTime(msg.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                              {msg.body}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
