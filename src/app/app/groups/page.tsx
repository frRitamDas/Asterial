"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Info,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { MobileUtilityActions } from "@/components/workspace/WorkspaceShell";
import { ConversationInfoDrawer } from "@/components/chat/ConversationInfoDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatShortTime } from "@/lib/utils/format";
import type {
  AttachmentRow,
  ConversationMemberRow,
  GroupMemberDetail,
  Profile,
} from "@/lib/types/database";

export default function GroupsPage() {
  const { conversations, setActiveModal } = useWorkspace();
  const [query, setQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [drawerMembers, setDrawerMembers] = useState<GroupMemberDetail[]>([]);
  const [drawerAttachments, setDrawerAttachments] = useState<AttachmentRow[]>(
    []
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (c.conversation.type !== "group") return false;
      if (!q) return true;
      return (
        c.displayTitle.toLowerCase().includes(q) ||
        (c.conversation.description || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, query]);

  const selectedSummary = useMemo(
    () =>
      groups.find((g) => g.conversation.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const fetchSelectedGroupMeta = useCallback(async () => {
    if (!selectedGroupId) return;
    const supabase = getSupabaseBrowserClient();
    const [memsRes, attsRes] = await Promise.all([
      supabase
        .from("conversation_members")
        .select("*")
        .eq("conversation_id", selectedGroupId)
        .is("left_at", null),
      supabase
        .from("attachments")
        .select("*")
        .eq("conversation_id", selectedGroupId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const rawMems = (memsRes.data || []) as ConversationMemberRow[];
    const userIds = rawMems.map((m) => m.user_id);
    const profMap = new Map<string, Profile>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);
      for (const p of (profs || []) as Profile[]) {
        profMap.set(p.id, p);
      }
      void primeAvatarSignedUrls(
        ((profs || []) as Profile[]).map((p) => p.avatar_url)
      );
    }

    const detailed: GroupMemberDetail[] = [];
    for (const m of rawMems) {
      const p = profMap.get(m.user_id);
      if (!p) continue;
      detailed.push({
        ...m,
        profile: p,
        last_seen_at: null,
      });
    }

    setDrawerMembers(detailed);
    setDrawerAttachments((attsRes.data || []) as AttachmentRow[]);
  }, [selectedGroupId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSelectedGroupMeta();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSelectedGroupMeta]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto bg-[var(--background)]">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-8 sm:py-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Groups
                </h1>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Multi-member group conversations with owner, admin, and member
                  permissions.
                </p>
              </div>
              <MobileUtilityActions />
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => setActiveModal("new-group")}
            >
              <Plus className="h-4 w-4" />
              <span>Create group</span>
            </Button>
          </div>

          <Input
            placeholder="Filter your groups…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftAddon={<Search className="h-4 w-4" />}
          />

          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-[var(--text-primary)]">
                {query.trim() ? "No matching groups" : "No groups yet"}
              </h2>
              <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)] leading-relaxed">
                {query.trim()
                  ? "Try a different group name or keyword."
                  : "Create a group to coordinate with teammates, friends, or study circles."}
              </p>
              {!query.trim() && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveModal("new-group")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create your first group</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => {
                const isSelected = selectedGroupId === g.conversation.id;
                return (
                  <div
                    key={g.conversation.id}
                    className={`flex flex-col justify-between gap-4 rounded-[16px] border bg-[var(--surface)] p-4 transition-colors ${
                      isSelected
                        ? "border-[var(--accent)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <Avatar
                        name={g.displayTitle}
                        avatarPath={g.displayAvatarPath}
                        size="lg"
                        isGroup
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {g.displayTitle}
                          </h3>
                          {g.membership.unread_count > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">
                              {g.membership.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <span>{g.displaySubtitle}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 capitalize">
                            {g.membership.role === "owner" && (
                              <Crown className="h-3 w-3 text-[var(--warning)]" />
                            )}
                            {g.membership.role === "admin" && (
                              <Shield className="h-3 w-3 text-[var(--accent)]" />
                            )}
                            {g.membership.role}
                          </span>
                        </div>
                        {g.conversation.description && (
                          <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">
                            {g.conversation.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {g.conversation.last_message_preview ||
                            "No messages yet"}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {formatShortTime(
                            g.conversation.last_message_at ||
                              g.conversation.created_at
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setSelectedGroupId((prev) =>
                              prev === g.conversation.id
                                ? null
                                : g.conversation.id
                            )
                          }
                        >
                          <Info className="h-3.5 w-3.5" />
                          <span>Manage</span>
                        </Button>
                        <Link
                          href={`/app/chats/${g.conversation.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--accent)] px-3 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Open</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Group Admin & Details Panel / Sheet */}
      {selectedSummary && (
        <ConversationInfoDrawer
          open
          onClose={() => setSelectedGroupId(null)}
          summary={selectedSummary}
          members={drawerMembers}
          sharedAttachments={drawerAttachments}
          onRefreshConversationDetail={fetchSelectedGroupMeta}
        />
      )}
    </div>
  );
}
