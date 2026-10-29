"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  Camera,
  Crown,
  Edit3,
  Flag,
  LogOut,
  Orbit,
  Pin,
  PinOff,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { AttachmentMedia } from "@/components/chat/AttachmentMedia";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, uploadAvatarFile } from "@/lib/supabase/storage";
import { formatLastSeen } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";
import type {
  AttachmentRow,
  ConversationSummary,
  GroupMemberDetail,
  UserSearchResult,
} from "@/lib/types/database";

interface ConversationInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  summary: ConversationSummary;
  members: GroupMemberDetail[];
  sharedAttachments: AttachmentRow[];
  onRefreshConversationDetail: () => Promise<void>;
}

export function ConversationInfoDrawer({
  open,
  onClose,
  summary,
  members,
  sharedAttachments,
  onRefreshConversationDetail,
}: ConversationInfoDrawerProps) {
  const router = useRouter();
  const {
    user,
    onlineUserIds,
    closeOrbitMap,
    upsertCloseOrbit,
    removeCloseOrbit,
    togglePin,
    toggleMute,
    toggleArchive,
    blockUser,
    unblockUser,
    isBlockedByMe,
    openReportModal,
    refreshConversations,
  } = useWorkspace();
  const { pushToast } = useToast();
  const groupAvatarRef = useRef<HTMLInputElement | null>(null);

  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState(summary.conversation.name || "");
  const [groupDesc, setGroupDesc] = useState(
    summary.conversation.description || ""
  );
  const [savingGroup, setSavingGroup] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [candidates, setCandidates] = useState<UserSearchResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!addMemberOpen) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("search_users", {
        p_query: memberSearch,
        p_limit: 20,
      });
      if (!active) return;
      const activeIds = new Set(members.map((m) => m.user_id));
      const filtered = ((data || []) as UserSearchResult[]).filter(
        (u) => !activeIds.has(u.id) && !u.is_blocked_by_me
      );
      void primeAvatarSignedUrls(filtered.map((u) => u.avatar_url));
      setCandidates(filtered);
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [addMemberOpen, memberSearch, members]);

  if (!open) return null;

  const isGroup = summary.conversation.type === "group";
  const myRole = summary.membership.role;
  const canManageGroup =
    isGroup && (myRole === "owner" || myRole === "admin");
  const peer = summary.peerProfile;
  const peerOnline = Boolean(peer && onlineUserIds.has(peer.id));
  const peerBlocked = Boolean(peer && isBlockedByMe(peer.id));

  const handleSaveGroupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSavingGroup(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("update_group_details", {
        p_conversation_id: summary.conversation.id,
        p_name: groupName.trim(),
        p_description: groupDesc.trim(),
        p_avatar_url: null,
      });
      if (error) {
        pushToast({
          title: "Could not update group",
          description: error.message,
          variant: "error",
        });
      } else {
        setEditingGroup(false);
        await Promise.all([
          refreshConversations(),
          onRefreshConversationDetail(),
        ]);
        pushToast({ title: "Group details updated", variant: "success" });
      }
    } finally {
      setSavingGroup(false);
    }
  };

  const handleGroupAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    try {
      const path = await uploadAvatarFile(user.id, file, "group");
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("update_group_details", {
        p_conversation_id: summary.conversation.id,
        p_name: summary.conversation.name || "Group",
        p_description: summary.conversation.description || "",
        p_avatar_url: path,
      });
      if (error) throw new Error(error.message);
      await Promise.all([refreshConversations(), onRefreshConversationDetail()]);
      pushToast({ title: "Group image updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Failed to update group image",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const handleAddMember = async (targetUser: UserSearchResult) => {
    setAddingId(targetUser.id);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("add_group_members", {
        p_conversation_id: summary.conversation.id,
        p_member_ids: [targetUser.id],
      });
      if (error) {
        pushToast({
          title: "Could not add member",
          description: error.message,
          variant: "error",
        });
      } else {
        await Promise.all([
          refreshConversations(),
          onRefreshConversationDetail(),
        ]);
        setCandidates((prev) => prev.filter((c) => c.id !== targetUser.id));
        pushToast({
          title: `Added ${targetUser.display_name}`,
          variant: "success",
        });
      }
    } finally {
      setAddingId(null);
    }
  };

  const handleRemoveMember = async (target: GroupMemberDetail) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("remove_group_member", {
      p_conversation_id: summary.conversation.id,
      p_target_user_id: target.user_id,
    });
    if (error) {
      pushToast({
        title: "Could not remove member",
        description: error.message,
        variant: "error",
      });
    } else {
      await Promise.all([refreshConversations(), onRefreshConversationDetail()]);
      pushToast({
        title: `Removed ${target.profile.display_name}`,
        variant: "success",
      });
    }
  };

  const handleRoleToggle = async (
    target: GroupMemberDetail,
    nextRole: "admin" | "member"
  ) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("update_group_member_role", {
      p_conversation_id: summary.conversation.id,
      p_target_user_id: target.user_id,
      p_new_role: nextRole,
    });
    if (error) {
      pushToast({
        title: "Could not update role",
        description: error.message,
        variant: "error",
      });
    } else {
      await onRefreshConversationDetail();
      pushToast({
        title: `${target.profile.display_name} is now ${nextRole}`,
        variant: "success",
      });
    }
  };

  const handleLeaveGroup = async () => {
    setLeaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("leave_group_conversation", {
        p_conversation_id: summary.conversation.id,
      });
      if (error) {
        pushToast({
          title: "Could not leave group",
          description: error.message,
          variant: "error",
        });
        setLeaving(false);
        return;
      }
      await refreshConversations();
      pushToast({ title: "Left group", variant: "success" });
      router.replace("/app/chats");
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  return (
    <>
      <aside
        aria-label="Conversation details"
        className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-void)] shadow-2xl xl:static xl:z-auto xl:w-[320px] xl:shadow-none animate-asterial-in"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest font-mono text-zinc-300">
            {isGroup ? "Group Info" : "Contact Info"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details panel"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Identity Card */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar
                name={summary.displayTitle}
                avatarPath={summary.displayAvatarPath}
                size="xl"
                isGroup={isGroup}
                online={peerOnline}
                showPresence={!isGroup}
              />
              {canManageGroup && (
                <>
                  <input
                    ref={groupAvatarRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleGroupAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => groupAvatarRef.current?.click()}
                    title="Change group image"
                    aria-label="Change group image"
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[var(--bg-elevated)] text-white hover:bg-white hover:text-zinc-950 transition-colors cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {editingGroup ? (
              <form
                onSubmit={handleSaveGroupDetails}
                className="mt-4 w-full space-y-2.5 text-left"
              >
                <Input
                  label="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={80}
                  required
                />
                <Textarea
                  label="Description"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  maxLength={300}
                  className="min-h-[68px]"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingGroup(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={savingGroup}
                  >
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {summary.displayTitle}
                  </h3>
                  {canManageGroup && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupName(summary.conversation.name || "");
                        setGroupDesc(summary.conversation.description || "");
                        setEditingGroup(true);
                      }}
                      aria-label="Edit group details"
                      className="rounded-md p-1 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="font-mono text-xs text-zinc-400">
                  {isGroup
                    ? `${members.length} ${members.length === 1 ? "member" : "members"}`
                    : peer
                      ? `@${peer.username}`
                      : ""}
                </p>
                {!isGroup && peer && (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {peerOnline
                      ? "Online now"
                      : formatLastSeen(summary.peerLastSeenAt)}
                  </p>
                )}
                {isGroup && summary.conversation.description && (
                  <p className="mt-2.5 text-xs text-zinc-300 leading-relaxed">
                    {summary.conversation.description}
                  </p>
                )}
                {!isGroup && peer?.status_text && (
                  <p className="mt-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                    {peer.status_text}
                  </p>
                )}
                {!isGroup && peer?.bio && (
                  <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
                    {peer.bio}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Private Close Orbit Quick Control (Direct Chats) */}
          {!isGroup && peer && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Orbit className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {closeOrbitMap.has(peer.id)
                        ? `In your ${
                            closeOrbitMap.get(peer.id)?.tier === "inner"
                              ? "Inner"
                              : "Priority"
                          } Orbit`
                        : "Close Orbit"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Private priority list — visible only to you
                    </p>
                  </div>
                </div>
                {closeOrbitMap.has(peer.id) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void removeCloseOrbit(peer.id)}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => void upsertCloseOrbit(peer.id, "inner")}
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Quick Thread Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                void togglePin(
                  summary.conversation.id,
                  !summary.membership.pinned
                )
              }
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] py-2.5 text-[11px] text-zinc-300 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              {summary.membership.pinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
              <span>{summary.membership.pinned ? "Unpin" : "Pin"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                void toggleMute(
                  summary.conversation.id,
                  !summary.membership.is_muted
                )
              }
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] py-2.5 text-[11px] text-zinc-300 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              {summary.membership.is_muted ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span>{summary.membership.is_muted ? "Unmute" : "Mute"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                void toggleArchive(
                  summary.conversation.id,
                  !summary.membership.archived
                )
              }
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] py-2.5 text-[11px] text-zinc-300 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              {summary.membership.archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              <span>
                {summary.membership.archived ? "Restore" : "Archive"}
              </span>
            </button>
          </div>

          {/* Group Members Section */}
          {isGroup && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Members ({members.length})
                </p>
                {canManageGroup && (
                  <button
                    type="button"
                    onClick={() => setAddMemberOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {members.map((m) => {
                  const isSelf = m.user_id === user?.id;
                  const memberOnline = onlineUserIds.has(m.user_id);
                  const canKick =
                    !isSelf &&
                    ((myRole === "owner" && m.role !== "owner") ||
                      (myRole === "admin" && m.role === "member"));
                  const canPromoteDemote =
                    !isSelf && myRole === "owner" && m.role !== "owner";

                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] p-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={m.profile.display_name}
                          avatarPath={m.profile.avatar_url}
                          size="sm"
                          online={memberOnline}
                          showPresence
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-white">
                              {m.profile.display_name}
                              {isSelf ? " (You)" : ""}
                            </span>
                            {m.role === "owner" && (
                              <Crown
                                className="h-3 w-3 shrink-0 text-amber-300"
                                aria-label="Owner"
                              />
                            )}
                            {m.role === "admin" && (
                              <Shield
                                className="h-3 w-3 shrink-0 text-zinc-300"
                                aria-label="Admin"
                              />
                            )}
                          </div>
                          <p className="truncate font-mono text-[10px] text-zinc-500">
                            @{m.profile.username} · {m.role}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canPromoteDemote && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRoleToggle(
                                m,
                                m.role === "admin" ? "member" : "admin"
                              )
                            }
                            title={
                              m.role === "admin"
                                ? "Demote to member"
                                : "Promote to admin"
                            }
                            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.08] hover:text-white cursor-pointer"
                          >
                            {m.role === "admin" ? "Demote" : "Make Admin"}
                          </button>
                        )}
                        {canKick && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(m)}
                            title={`Remove ${m.profile.display_name}`}
                            aria-label={`Remove ${m.profile.display_name}`}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shared Media & Files */}
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Shared Media &amp; Files ({sharedAttachments.length})
            </p>
            {sharedAttachments.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] p-4 text-center text-xs text-zinc-500">
                No attachments shared in this conversation yet.
              </p>
            ) : (
              <div className="space-y-2">
                {sharedAttachments.slice(0, 12).map((att) => (
                  <AttachmentMedia
                    key={att.id}
                    attachment={att}
                    isOwnMessage={false}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Safety, Block, Leave & Report Actions */}
          <div className="space-y-2 border-t border-white/[0.08] pt-4">
            {!isGroup && peer && (
              <Button
                variant={peerBlocked ? "secondary" : "danger"}
                size="sm"
                className="w-full justify-start"
                onClick={() =>
                  peerBlocked
                    ? void unblockUser(peer.id)
                    : void blockUser(peer.id)
                }
              >
                <Ban className="h-3.5 w-3.5" />
                {peerBlocked
                  ? `Unblock @${peer.username}`
                  : `Block @${peer.username}`}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-zinc-400"
              onClick={() =>
                openReportModal({
                  reportedUserId: peer?.id || null,
                  conversationId: summary.conversation.id,
                  label: summary.displayTitle,
                })
              }
            >
              <Flag className="h-3.5 w-3.5" />
              Report {isGroup ? "group" : "user"}
            </Button>

            {isGroup && (
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-start"
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave group
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Add Group Member Dialog */}
      <Dialog
        open={addMemberOpen}
        onClose={() => {
          setAddMemberOpen(false);
          setMemberSearch("");
          setCandidates([]);
        }}
        title={`Add members to ${summary.displayTitle}`}
        description="Search users to invite into this group conversation."
      >
        <div className="space-y-3">
          <Input
            placeholder="Search @username or display name..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {candidates.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No eligible users found.
              </p>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={c.display_name}
                      avatarPath={c.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">
                        {c.display_name}
                      </p>
                      <p className="truncate font-mono text-[10px] text-zinc-500">
                        @{c.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={addingId === c.id}
                    onClick={() => void handleAddMember(c)}
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Dialog>

      {/* Confirm Leave Group Dialog */}
      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave group?"
        description={`You will stop receiving messages from "${summary.displayTitle}" unless an administrator adds you back.`}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={leaving}
            onClick={() => void handleLeaveGroup()}
          >
            Leave group
          </Button>
        </div>
      </Dialog>
    </>
  );
}
