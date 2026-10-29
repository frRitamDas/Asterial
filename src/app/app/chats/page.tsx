"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  MessageSquarePlus,
  Orbit,
  Search,
  Users,
} from "lucide-react";
import { AsterialMark } from "@/components/brand/AsterialLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { formatShortTime } from "@/lib/utils/format";

export default function ChatsOverviewPage() {
  const {
    conversations,
    closeOrbitItems,
    onlineUserIds,
    setActiveModal,
    startDirectConversation,
  } = useWorkspace();

  const activeConversations = conversations
    .filter((c) => !c.membership.archived)
    .slice(0, 4);

  return (
    <div className="flex h-full w-full flex-col justify-center overflow-y-auto bg-[var(--background)] px-6 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <AsterialMark size={36} />
              <div>
                <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  Select a conversation
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Pick a thread from the left panel or start a new chat.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal("search")}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>⌘K</span>
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => setActiveModal("new-dm")}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>New Direct Message</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveModal("new-group")}
            >
              <Users className="h-4 w-4" />
              <span>Create Group</span>
            </Button>
            <Link
              href="/app/people"
              className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span>People Directory</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent / Pinned Quick Jump */}
        {activeConversations.length > 0 && (
          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                Recent conversations
              </h3>
              <Link
                href="/app/groups"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Manage groups
              </Link>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {activeConversations.map((item) => {
                const isPeerOnline =
                  item.conversation.type === "direct" &&
                  item.peerProfile?.presence_visibility !== "nobody" &&
                  Boolean(
                    item.peerProfile && onlineUserIds.has(item.peerProfile.id)
                  );
                return (
                  <Link
                    key={item.conversation.id}
                    href={`/app/chats/${item.conversation.id}`}
                    className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={item.displayTitle}
                        avatarPath={item.displayAvatarPath}
                        size="md"
                        isGroup={item.conversation.type === "group"}
                        online={isPeerOnline}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {item.displayTitle}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-secondary)]">
                          {item.conversation.last_message_preview ||
                            item.displaySubtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.membership.unread_count > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">
                          {item.membership.unread_count}
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatShortTime(
                          item.conversation.last_message_at ||
                            item.conversation.created_at
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Close Orbit Quick Shortcuts */}
        {closeOrbitItems.length > 0 && (
          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                <Orbit className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Close Orbit</span>
              </div>
              <Link
                href="/app/orbits"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                View Orbits
              </Link>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {closeOrbitItems.slice(0, 6).map((person) => (
                <button
                  key={person.contact_id}
                  type="button"
                  onClick={() => void startDirectConversation(person.contact_id)}
                  className="flex shrink-0 items-center gap-2 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                >
                  <Avatar
                    name={person.display_name}
                    avatarPath={person.avatar_url}
                    size="xs"
                  />
                  <span className="max-w-[110px] truncate text-xs font-medium text-[var(--text-primary)]">
                    {person.display_name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
