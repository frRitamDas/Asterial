"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Layers,
  Plus,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatShortTime } from "@/lib/utils/format";

export default function GroupsPage() {
  const { conversations, setActiveModal } = useWorkspace();
  const [query, setQuery] = useState("");

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

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8 space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-subtle)] pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <Layers className="h-3.5 w-3.5 text-zinc-300" />
              <span>Multi-Member Channels</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              Groups
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Private group spaces with owner, admin, and member access control.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setActiveModal("new-group")}
          >
            <Plus className="h-4 w-4" />
            Create group
          </Button>
        </div>

        <Input
          placeholder="Filter your groups..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
        />

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]">
              <Users className="h-5 w-5 text-zinc-300" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-white">
              {query.trim() ? "No matching groups" : "No groups joined yet"}
            </h2>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-400">
              {query.trim()
                ? "Try a different group name or keyword."
                : "Create a group to bring multiple people together in a shared real-time space."}
            </p>
            {!query.trim() && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-5"
                onClick={() => setActiveModal("new-group")}
              >
                <Plus className="h-3.5 w-3.5" />
                Create your first group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <Link
                key={g.conversation.id}
                href={`/app/chats/${g.conversation.id}`}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-4 hover:border-white/25 transition-colors"
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
                      <h3 className="truncate text-sm font-semibold text-white">
                        {g.displayTitle}
                      </h3>
                      {g.membership.unread_count > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1.5 font-mono text-[10px] font-bold text-zinc-950">
                          {g.membership.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                      <span>{g.displaySubtitle}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 capitalize">
                        {g.membership.role === "owner" && (
                          <Crown className="h-3 w-3 text-amber-300" />
                        )}
                        {g.membership.role === "admin" && (
                          <Shield className="h-3 w-3 text-zinc-300" />
                        )}
                        {g.membership.role}
                      </span>
                    </div>
                    {g.conversation.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                        {g.conversation.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs">
                  <span className="truncate text-zinc-400">
                    {g.conversation.last_message_preview || "No messages yet"}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                    {formatShortTime(
                      g.conversation.last_message_at ||
                        g.conversation.created_at
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
