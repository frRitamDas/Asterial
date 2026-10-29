"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  MessageSquarePlus,
  MoreHorizontal,
  Orbit,
  Pin,
  PinOff,
  Search,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatShortTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

type SidebarFilter = "all" | "unread" | "direct" | "groups" | "archived";

export function ConversationSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const {
    conversations,
    onlineUserIds,
    closeOrbitMap,
    drafts,
    loadingInitial,
    setActiveModal,
    togglePin,
    toggleMute,
    toggleArchive,
    markConversationRead,
  } = useWorkspace();

  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const archivedCount = useMemo(
    () => conversations.filter((c) => c.membership.archived).length,
    [conversations]
  );

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

  return (
    <aside
      aria-label="Conversations"
      className={cn(
        "flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]",
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            Messages
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {ASTERIAL_BRAND.name} {ASTERIAL_BRAND.version}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveModal("search")}
            title="Unified Search (⌘K)"
            aria-label="Unified Search"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("new-group")}
            title="New group"
            aria-label="New group"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("new-dm")}
            title="New direct message"
            aria-label="New direct message"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Box */}
      <div className="px-3.5 pb-2.5">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter inbox or press ⌘K…"
            aria-label="Filter conversations"
            className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-8.5 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto px-3.5 pb-2.5 no-scrollbar">
        {(
          [
            ["all", "All"],
            ["unread", "Unread"],
            ["direct", "Direct"],
            ["groups", "Groups"],
            [
              "archived",
              archivedCount > 0 ? `Archived (${archivedCount})` : "Archived",
            ],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              filter === id
                ? "bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]"
                : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div
        className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5"
        onClick={() => {
          if (openMenuId) setOpenMenuId(null);
        }}
      >
        {loadingInitial ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {searchQuery.trim()
                ? "No conversations match your filter"
                : filter === "archived"
                  ? "No archived conversations"
                  : filter === "unread"
                    ? "You are all caught up"
                    : "No conversations yet"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
              {searchQuery.trim()
                ? "Open Unified Search (⌘K) to search across People, Messages, Moments, and Feed."
                : "Start a direct thread or create a group to begin."}
            </p>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setActiveModal("search")}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                Search entire workspace
              </button>
            ) : filter === "all" ? (
              <button
                type="button"
                onClick={() => setActiveModal("new-dm")}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-medium text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Start conversation
              </button>
            ) : null}
          </div>
        ) : (
          filteredConversations.map((item) => {
            const href = `/app/chats/${item.conversation.id}`;
            const isActive = pathname === href;
            const isPeerOnline =
              item.conversation.type === "direct" &&
              Boolean(item.peerProfile && onlineUserIds.has(item.peerProfile.id));
            const inCloseOrbit =
              item.conversation.type === "direct" &&
              Boolean(item.peerProfile && closeOrbitMap.has(item.peerProfile.id));
            const draftText = drafts[item.conversation.id]?.trim();
            const unread = item.membership.unread_count;
            const menuOpen = openMenuId === item.conversation.id;

            return (
              <div key={item.conversation.id} className="relative group">
                <Link
                  href={href}
                  style={{
                    paddingTop: "var(--conv-item-py)",
                    paddingBottom: "var(--conv-item-py)",
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 transition-colors",
                    isActive
                      ? "bg-[var(--accent-signal-subtle)] border border-[var(--border-active)]"
                      : "border border-transparent hover:bg-white/[0.04]"
                  )}
                >
                  <Avatar
                    name={item.displayTitle}
                    avatarPath={item.displayAvatarPath}
                    size="md"
                    isGroup={item.conversation.type === "group"}
                    online={isPeerOnline}
                    showPresence={item.conversation.type === "direct"}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            "truncate text-sm",
                            unread > 0
                              ? "font-semibold text-[var(--text-primary)]"
                              : "font-medium text-[var(--text-primary)]/90"
                          )}
                        >
                          {item.displayTitle}
                        </span>
                        {inCloseOrbit && (
                          <Orbit
                            className="h-3 w-3 shrink-0 text-[var(--accent-primary)]"
                            aria-label="In your Close Orbit"
                          />
                        )}
                        {item.membership.pinned && (
                          <Pin
                            className="h-3 w-3 shrink-0 text-[var(--text-secondary)]"
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
                      <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)] group-hover:opacity-0 transition-opacity">
                        {formatShortTime(
                          item.conversation.last_message_at ||
                            item.conversation.created_at
                        )}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      {draftText ? (
                        <p className="truncate text-xs">
                          <span className="font-medium text-[var(--accent-primary)]">
                            Draft:{" "}
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            {draftText}
                          </span>
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "truncate text-xs",
                            unread > 0
                              ? "text-[var(--text-primary)]/85 font-medium"
                              : "text-[var(--text-muted)]"
                          )}
                        >
                          {item.conversation.last_message_preview ||
                            "No messages yet"}
                        </p>
                      )}
                      {unread > 0 && (
                        <span className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 font-mono text-[10px] font-semibold text-[var(--accent-primary-fg)]">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Conversation quick menu trigger */}
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
                    "absolute right-2 top-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-opacity cursor-pointer",
                    menuOpen
                      ? "opacity-100"
                      : "opacity-0 focus:opacity-100 group-hover:opacity-100"
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-10 z-30 w-44 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-1 shadow-2xl animate-asterial-in"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        void togglePin(
                          item.conversation.id,
                          !item.membership.pinned
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] cursor-pointer"
                    >
                      {item.membership.pinned ? (
                        <>
                          <PinOff className="h-3.5 w-3.5" />
                          Unpin chat
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5" />
                          Pin chat
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        void toggleMute(
                          item.conversation.id,
                          !item.membership.is_muted
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] cursor-pointer"
                    >
                      {item.membership.is_muted ? (
                        <>
                          <Bell className="h-3.5 w-3.5" />
                          Unmute notifications
                        </>
                      ) : (
                        <>
                          <BellOff className="h-3.5 w-3.5" />
                          Mute notifications
                        </>
                      )}
                    </button>

                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          void markConversationRead(item.conversation.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark as read
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        void toggleArchive(
                          item.conversation.id,
                          !item.membership.archived
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] cursor-pointer"
                    >
                      {item.membership.archived ? (
                        <>
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          Restore to inbox
                        </>
                      ) : (
                        <>
                          <Archive className="h-3.5 w-3.5" />
                          Archive chat
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
