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
        "flex h-full flex-col border-r border-white/[0.07] bg-[#090a0f]",
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-6">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.04em] text-white">
            Messages
          </h1>
          <p className="mt-1 text-[10px] font-medium tracking-[0.12em] text-zinc-600">
            {ASTERIAL_BRAND.name} Workspace
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveModal("new-group")}
            title="New group"
            aria-label="New group"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white cursor-pointer"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("new-dm")}
            title="New direct message"
            aria-label="New direct message"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-200 text-[#071018] transition hover:bg-sky-100 cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Box */}
      <div className="px-4 pb-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter conversations..."
            aria-label="Filter conversations"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 transition focus:border-sky-200/30 focus:bg-white/[0.04] focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar">
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
              "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer",
              filter === id
                ? "bg-sky-200 text-[#071018]"
                : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div
        className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1"
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
            <p className="text-xs font-medium text-zinc-300">
              {searchQuery.trim()
                ? "No conversations match your filter"
                : filter === "archived"
                  ? "No archived conversations"
                  : filter === "unread"
                    ? "You are all caught up"
                    : "No conversations yet"}
            </p>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              {searchQuery.trim()
                ? "Try searching across all messages with ⌘K."
                : "Start a direct thread or create a group to begin."}
            </p>
            {!searchQuery.trim() && filter === "all" && (
              <button
                type="button"
                onClick={() => setActiveModal("new-dm")}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Start conversation
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((item) => {
            const href = `/app/chats/${item.conversation.id}`;
            const isActive = pathname === href;
            const isPeerOnline =
              item.conversation.type === "direct" &&
              Boolean(item.peerProfile && onlineUserIds.has(item.peerProfile.id));
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
                    "flex items-center gap-3 rounded-2xl px-3 transition duration-200",
                    isActive
                      ? "bg-gradient-to-r from-sky-200/[0.10] to-indigo-200/[0.04] border border-sky-200/15 shadow-[inset_2px_0_0_rgba(158,220,255,.8)]"
                      : "border border-transparent hover:bg-white/[0.035]"
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
                            "truncate text-[13px] tracking-[-0.01em]",
                            unread > 0
                              ? "font-semibold text-white"
                              : "font-medium text-zinc-200"
                          )}
                        >
                          {item.displayTitle}
                        </span>
                        {item.membership.pinned && (
                          <Pin
                            className="h-3 w-3 shrink-0 text-zinc-400"
                            aria-label="Pinned"
                          />
                        )}
                        {item.membership.is_muted && (
                          <BellOff
                            className="h-3 w-3 shrink-0 text-zinc-500"
                            aria-label="Muted"
                          />
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500 group-hover:opacity-0 transition-opacity">
                        {formatShortTime(
                          item.conversation.last_message_at ||
                            item.conversation.created_at
                        )}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-[11px] leading-5",
                          unread > 0 ? "text-zinc-300" : "text-zinc-500"
                        )}
                      >
                        {item.conversation.last_message_preview ||
                          "No messages yet"}
                      </p>
                      {unread > 0 && (
                        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sky-200 px-1.5 font-mono text-[9px] font-bold text-[#071018]">
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
                    "absolute right-2 top-2.5 rounded-lg border border-white/10 bg-[var(--bg-elevated)] p-1 text-zinc-400 hover:text-white transition-opacity cursor-pointer",
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
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
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
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
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
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
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
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
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
