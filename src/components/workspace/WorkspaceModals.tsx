"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Loader2,
  MessageSquare,
  Search,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, uploadAvatarFile } from "@/lib/supabase/storage";
import { formatShortTime } from "@/lib/utils/format";
import {
  groupCreateSchema,
  reportCreateSchema,
} from "@/lib/validation/schemas";
import { useToast } from "@/components/ui/Toast";
import type {
  MessageSearchResult,
  ReportCategory,
  UserSearchResult,
} from "@/lib/types/database";

export function WorkspaceModals() {
  const { activeModal, reportTarget } = useWorkspace();
  return (
    <>
      {activeModal === "new-dm" && <NewDirectConversationModal />}
      {activeModal === "new-group" && <CreateGroupModal />}
      {activeModal === "search" && <GlobalSearchModal />}
      {reportTarget && <ReportModal />}
    </>
  );
}

function NewDirectConversationModal() {
  const router = useRouter();
  const { setActiveModal, startDirectConversation, onlineUserIds } =
    useWorkspace();
  const open = true;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.rpc("search_users", {
          p_query: query,
          p_limit: 20,
        });
        if (!active) return;
        const list = (data || []) as UserSearchResult[];
        void primeAvatarSignedUrls(list.map((u) => u.avatar_url));
        setResults(list);
      } finally {
        if (active) setResolvedQuery(query);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const loading = resolvedQuery !== query;

  const handleSelect = async (target: UserSearchResult) => {
    setStartingId(target.id);
    const convId = await startDirectConversation(target.id);
    setStartingId(null);
    if (convId) {
      setActiveModal(null);
      router.push(`/app/chats/${convId}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => setActiveModal(null)}
      title="New direct conversation"
      description="Search by @username or display name to begin a real-time thread."
    >
      <div className="space-y-4">
        <Input
          placeholder="Search @username or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-zinc-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching directory...
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
              {query.trim()
                ? `No users found matching "${query.trim()}".`
                : "No other registered users yet. Invite someone to ASTERIAL."}
            </div>
          ) : (
            results.map((item) => {
              const isOnline = onlineUserIds.has(item.id);
              const disabled =
                item.is_blocked_by_me || item.allow_direct_messages === "none";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-2.5 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={item.display_name}
                      avatarPath={item.avatar_url}
                      size="md"
                      online={isOnline}
                      showPresence
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.display_name}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono truncate">
                        @{item.username}
                        {item.status_text ? ` · ${item.status_text}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={disabled ? "ghost" : "secondary"}
                    disabled={disabled}
                    loading={startingId === item.id}
                    onClick={() => handleSelect(item)}
                  >
                    {item.is_blocked_by_me
                      ? "Blocked"
                      : item.allow_direct_messages === "none"
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

function CreateGroupModal() {
  const router = useRouter();
  const { user, setActiveModal, refreshConversations } = useWorkspace();
  const { pushToast } = useToast();
  const open = true;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("search_users", {
        p_query: query,
        p_limit: 20,
      });
      if (!active) return;
      const list = ((data || []) as UserSearchResult[]).filter(
        (u) => !u.is_blocked_by_me
      );
      void primeAvatarSignedUrls(list.map((u) => u.avatar_url));
      setCandidates(list);
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const path = await uploadAvatarFile(user.id, file, "group");
      setAvatarPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload icon.");
    } finally {
      setUploadingAvatar(false);
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
      setError(parsed.error.issues[0]?.message || "Invalid group details.");
      return;
    }

    setCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: convId, error: rpcErr } = await supabase.rpc(
        "create_group_conversation",
        {
          p_name: parsed.data.name,
          p_description: parsed.data.description,
          p_member_ids: parsed.data.memberIds,
          p_avatar_url: avatarPath,
        }
      );

      if (rpcErr || !convId) {
        setError(rpcErr?.message || "Failed to create group.");
        setCreating(false);
        return;
      }

      await refreshConversations();
      setActiveModal(null);
      pushToast({
        title: `Created "${parsed.data.name}"`,
        variant: "success",
      });
      router.push(`/app/chats/${String(convId)}`);
    } catch {
      setError("Network error while creating group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
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
          placeholder="Purpose or topic of this group..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />

        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide text-zinc-300">
            Add members ({selectedUsers.length} selected)
          </label>
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white"
                >
                  {u.display_name}
                  <button
                    type="button"
                    aria-label={`Remove ${u.display_name}`}
                    onClick={() => toggleMember(u)}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Input
            placeholder="Filter people by @username or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftAddon={<Users className="h-4 w-4" />}
          />

          <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-white/[0.07] bg-[var(--bg-canvas)] p-2">
            {candidates.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500">
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
                        <p className="text-xs font-medium text-white truncate">
                          {c.display_name}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 truncate">
                          @{c.username}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        selected
                          ? "border-white bg-white text-zinc-950"
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

function GlobalSearchModal() {
  const router = useRouter();
  const { setActiveModal, conversations } = useWorkspace();
  const open = true;

  const [query, setQuery] = useState("");
  const [fetchedMessages, setFetchedMessages] = useState<{
    query: string;
    items: MessageSearchResult[];
  } | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("search_messages", {
        p_query: trimmed,
        p_conversation_id: null,
        p_limit: 25,
      });
      if (active) {
        setFetchedMessages({
          query: trimmed,
          items: (data || []) as MessageSearchResult[],
        });
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const loading = trimmed.length >= 2 && fetchedMessages?.query !== trimmed;
  const messages =
    trimmed.length >= 2 && fetchedMessages?.query === trimmed
      ? fetchedMessages.items
      : [];

  const matchingConvs = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return (
      c.displayTitle.toLowerCase().includes(q) ||
      c.displaySubtitle.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog
      open={open}
      onClose={() => setActiveModal(null)}
      title="Search workspace"
      description="Jump to conversations or find messages across your accessible threads."
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <Input
          placeholder="Type at least 2 characters to search messages & chats..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
          autoFocus
        />

        <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
          {!query.trim() ? (
            <p className="py-8 text-center text-xs text-zinc-500">
              Search by conversation name, @handle, or message text.
            </p>
          ) : (
            <>
              {matchingConvs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 px-1">
                    Conversations
                  </p>
                  {matchingConvs.slice(0, 6).map((c) => (
                    <button
                      key={c.conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(`/app/chats/${c.conversation.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-2.5 text-left hover:border-white/20 transition-colors cursor-pointer"
                    >
                      <Avatar
                        name={c.displayTitle}
                        avatarPath={c.displayAvatarPath}
                        size="sm"
                        isGroup={c.conversation.type === "group"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">
                          {c.displayTitle}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {c.displaySubtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 px-1">
                  Messages
                </p>
                {loading ? (
                  <div className="flex items-center justify-center py-6 text-xs text-zinc-500 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching messages...
                  </div>
                ) : query.trim().length < 2 ? (
                  <p className="px-1 py-3 text-xs text-zinc-500">
                    Enter at least 2 characters to search message contents.
                  </p>
                ) : messages.length === 0 ? (
                  <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center text-xs text-zinc-500">
                    No messages matched &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : (
                  messages.map((m) => (
                    <button
                      key={m.message_id}
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        router.push(
                          `/app/chats/${m.conversation_id}?highlight=${m.message_id}`
                        );
                      }}
                      className="flex w-full items-start gap-3 rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-3 text-left hover:border-white/20 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {m.conversation_name || "Conversation"}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                            {formatShortTime(m.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-300 line-clamp-2">
                          <span className="text-zinc-500">
                            {m.sender_display_name || "Member"}:{" "}
                          </span>
                          {m.body}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
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
          <label className="text-xs font-medium text-zinc-300">Reason</label>
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
                    ? "border-white bg-white text-zinc-950 font-medium"
                    : "border-white/10 bg-[var(--bg-canvas)] text-zinc-300 hover:border-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Additional context (optional)"
          placeholder="Provide any relevant details..."
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
