"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flag,
  Globe,
  Hash,
  Lock,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  OrbitChannelRow,
  OrbitMemberRow,
  OrbitMessageRow,
  OrbitRole,
  OrbitRow,
  Profile,
} from "@asterial/core";
import { canModerateOrbit, orbitChannelCreateSchema } from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  primeAvatarSignedUrls,
  primeBucketSignedUrls,
  resolveSignedUrl,
  uploadAvatarFile,
  uploadSocialMediaFile,
} from "@/lib/supabase/storage";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { PrivateMediaImage } from "@/components/ui/PrivateMediaImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { formatByteSize, formatMessageTime } from "@/lib/utils/format";

interface EnrichedOrbitMember extends OrbitMemberRow {
  profile: Profile | null;
}

export default function OrbitWorkspacePage() {
  const params = useParams<{ orbitId: string }>();
  const orbitId = params?.orbitId || "";
  const router = useRouter();
  const { user, openReportModal, isBlockedByMe } = useWorkspace();
  const { pushToast } = useToast();

  const [orbit, setOrbit] = useState<OrbitRow | null>(null);
  const [channels, setChannels] = useState<OrbitChannelRow[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<EnrichedOrbitMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<OrbitMessageRow[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingOrbit, setLoadingOrbit] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(
    null
  );
  const [joiningPublic, setJoiningPublic] = useState(false);

  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [composerBody, setComposerBody] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const sendLockRef = useRef(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [chanName, setChanName] = useState("");
  const [chanTopic, setChanTopic] = useState("");
  const [chanAnnouncement, setChanAnnouncement] = useState(false);
  const [creatingChan, setCreatingChan] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVis, setEditVis] = useState<"public" | "private">("public");
  const [editIcon, setEditIcon] = useState<File | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<Profile[]>([]);

  const myMember = useMemo(
    () =>
      members.find((m) => m.user_id === user?.id && m.status === "active") ||
      null,
    [members, user?.id]
  );
  const myRole: OrbitRole | null = myMember?.role ?? null;
  const isModerator = canModerateOrbit(myRole);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || channels[0] || null,
    [activeChannelId, channels]
  );

  const canPostInActiveChannel = Boolean(
    myMember && (!activeChannel?.is_announcement || isModerator)
  );

  const loadOrbitData = useCallback(async () => {
    if (!user?.id || !orbitId) return;
    const supabase = getSupabaseBrowserClient();

    const { data: orbitData, error: orbitErr } = await supabase
      .from("orbits")
      .select("*")
      .eq("id", orbitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (orbitErr || !orbitData) {
      setOrbit(null);
      setUnavailableReason(
        "This Orbit is private, deleted, or you do not have permission to view it."
      );
      setLoadingOrbit(false);
      return;
    }

    const typedOrbit = orbitData as OrbitRow;
    setOrbit(typedOrbit);
    setUnavailableReason(null);

    const [membersRes, channelsRes] = await Promise.all([
      supabase
        .from("orbit_members")
        .select("*")
        .eq("orbit_id", orbitId)
        .in("status", ["active", "banned"]),
      supabase
        .from("orbit_channels")
        .select("*")
        .eq("orbit_id", orbitId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const rawMembers = (membersRes.data || []) as OrbitMemberRow[];
    const userIds = Array.from(new Set(rawMembers.map((m) => m.user_id)));
    const profileMap: Record<string, Profile> = {};

    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);
      for (const p of (profs || []) as Profile[]) {
        profileMap[p.id] = p;
      }
      await primeAvatarSignedUrls([
        typedOrbit.icon_url,
        ...Object.values(profileMap).map((p) => p.avatar_url),
      ]);
    }

    setProfilesById((prev) => ({ ...prev, ...profileMap }));
    setMembers(
      rawMembers.map((m) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      }))
    );

    const chanList = (channelsRes.data || []) as OrbitChannelRow[];
    setChannels(chanList);
    setActiveChannelId((prev) =>
      prev && chanList.some((c) => c.id === prev)
        ? prev
        : chanList.find((c) => !c.is_announcement)?.id || chanList[0]?.id || null
    );
    setLoadingOrbit(false);
  }, [orbitId, user?.id]);

  const loadChannelMessages = useCallback(
    async (channelId: string) => {
      if (!user?.id) return;
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_orbit_messages_page", {
        p_channel_id: channelId,
        p_before_created_at: null,
        p_before_id: null,
        p_limit: 40,
      });
      if (error) return;
      const descRows = (data || []) as OrbitMessageRow[];
      setHasOlderMessages(descRows.length === 40);
      const ascRows = [...descRows].reverse();
      await primeBucketSignedUrls(
        "social-media",
        ascRows.map((m) => m.attachment_path)
      );

      const missingSenderIds = Array.from(
        new Set(
          ascRows
            .map((m) => m.sender_id)
            .filter((id): id is string => Boolean(id && !profilesById[id]))
        )
      );
      if (missingSenderIds.length > 0) {
        const { data: extraProfs } = await supabase
          .from("profiles")
          .select("*")
          .in("id", missingSenderIds);
        if (extraProfs) {
          const map: Record<string, Profile> = {};
          for (const p of extraProfs as Profile[]) {
            map[p.id] = p;
          }
          setProfilesById((prev) => ({ ...prev, ...map }));
        }
      }

      setMessages(ascRows);
    },
    [profilesById, user?.id]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrbitData();
  }, [loadOrbitData]);

  useEffect(() => {
    if (activeChannel?.id && myMember) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadChannelMessages(activeChannel.id);
    }
  }, [activeChannel?.id, loadChannelMessages, myMember]);

  useEffect(() => {
    if (!activeChannel?.id || !myMember) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`orbit-room-${orbitId}-${activeChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_messages",
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        () => {
          void loadChannelMessages(activeChannel.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_members",
          filter: `orbit_id=eq.${orbitId}`,
        },
        () => {
          void loadOrbitData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_channels",
          filter: `orbit_id=eq.${orbitId}`,
        },
        () => {
          void loadOrbitData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChannel?.id, loadChannelMessages, loadOrbitData, myMember, orbitId]);

  useEffect(() => {
    if (!inviteOpen || !user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const timer = setTimeout(async () => {
      const q = inviteQuery.trim();
      let req = supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .limit(12);
      if (q) {
        req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      }
      const { data } = await req;
      const activeIds = new Set(
        members.filter((m) => m.status === "active").map((m) => m.user_id)
      );
      setInviteResults(
        ((data || []) as Profile[]).filter((p) => !activeIds.has(p.id))
      );
    }, 180);
    return () => clearTimeout(timer);
  }, [inviteOpen, inviteQuery, members, user?.id]);

  const handleLoadOlder = async () => {
    if (!activeChannel || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    setLoadingOlder(true);
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.rpc("get_orbit_messages_page", {
      p_channel_id: activeChannel.id,
      p_before_created_at: oldest.created_at,
      p_before_id: oldest.id,
      p_limit: 40,
    });
    const olderDesc = (data || []) as OrbitMessageRow[];
    setHasOlderMessages(olderDesc.length === 40);
    const olderAsc = [...olderDesc].reverse();
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...olderAsc.filter((m) => !seen.has(m.id)), ...prev];
    });
    setLoadingOlder(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !user?.id ||
      !orbit ||
      !activeChannel ||
      !canPostInActiveChannel ||
      sendLockRef.current
    ) {
      return;
    }

    const trimmed = composerBody.trim();
    if (!trimmed && !stagedFile) return;

    sendLockRef.current = true;
    setSending(true);
    try {
      let uploaded: {
        storagePath: string;
        fileName: string;
        mimeType: string;
        byteSize: number;
      } | null = null;

      if (stagedFile) {
        setUploadPercent(0);
        uploaded = await uploadSocialMediaFile({
          domain: "orbits",
          userId: user.id,
          orbitId: orbit.id,
          file: stagedFile,
          kind: "attachment",
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("orbit_messages").insert({
        orbit_id: orbit.id,
        channel_id: activeChannel.id,
        sender_id: user.id,
        client_id: crypto.randomUUID(),
        kind: "user",
        body: trimmed,
        attachment_path: uploaded?.storagePath || null,
        attachment_name: uploaded?.fileName || null,
        attachment_mime: uploaded?.mimeType || null,
        attachment_size: uploaded?.byteSize || null,
      });

      if (error) throw new Error(error.message);
      setComposerBody("");
      setStagedFile(null);
      setUploadPercent(null);
      await loadChannelMessages(activeChannel.id);
    } catch (err) {
      pushToast({
        title: "Message could not be sent",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSending(false);
      setUploadPercent(null);
      sendLockRef.current = false;
    }
  };

  const handleSaveEditMessage = async (messageId: string) => {
    const clean = editingBody.trim();
    if (!clean) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("orbit_messages")
      .update({ body: clean })
      .eq("id", messageId);
    if (error) {
      pushToast({
        title: "Could not edit message",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setEditingMessageId(null);
    setEditingBody("");
    if (activeChannel) await loadChannelMessages(activeChannel.id);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_orbit_message", {
      p_message_id: messageId,
    });
    if (error) {
      pushToast({
        title: "Could not delete message",
        description: error.message,
        variant: "error",
      });
      return;
    }
    if (activeChannel) await loadChannelMessages(activeChannel.id);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orbit || creatingChan) return;
    const parsed = orbitChannelCreateSchema.safeParse({
      name: chanName,
      topic: chanTopic,
      isAnnouncement: chanAnnouncement,
    });
    if (!parsed.success) {
      pushToast({
        title: "Invalid channel details",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }
    setCreatingChan(true);
    const supabase = getSupabaseBrowserClient();
    const { data: newId, error } = await supabase.rpc("create_orbit_channel", {
      p_orbit_id: orbit.id,
      p_name: parsed.data.name,
      p_topic: parsed.data.topic,
      p_is_announcement: parsed.data.isAnnouncement,
    });
    setCreatingChan(false);
    if (error) {
      pushToast({
        title: "Could not create channel",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setNewChannelOpen(false);
    setChanName("");
    setChanTopic("");
    setChanAnnouncement(false);
    await loadOrbitData();
    if (newId) setActiveChannelId(newId as string);
  };

  const handleModerateMember = async (
    targetUserId: string,
    action: "kick" | "ban" | "unban" | "set_role",
    newRole: "admin" | "member" = "member"
  ) => {
    if (!orbit) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("moderate_orbit_member", {
      p_orbit_id: orbit.id,
      p_target_user_id: targetUserId,
      p_action: action,
      p_new_role: newRole,
    });
    if (error) {
      pushToast({
        title: "Moderation action failed",
        description: error.message,
        variant: "error",
      });
      return;
    }
    pushToast({ title: "Member updated", variant: "success" });
    await loadOrbitData();
  };

  const handleInviteMember = async (targetUserId: string) => {
    if (!orbit) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("invite_orbit_member", {
      p_orbit_id: orbit.id,
      p_target_user_id: targetUserId,
    });
    if (error) {
      pushToast({
        title: "Could not add member",
        description: error.message,
        variant: "error",
      });
      return;
    }
    pushToast({ title: "Member added to Orbit", variant: "success" });
    await loadOrbitData();
    setInviteResults((prev) => prev.filter((p) => p.id !== targetUserId));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orbit || !user?.id || savingSettings) return;
    setSavingSettings(true);
    try {
      let iconPath = orbit.icon_url;
      if (editIcon) {
        iconPath = await uploadAvatarFile(user.id, editIcon, "orbit");
      }
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("update_orbit_details", {
        p_orbit_id: orbit.id,
        p_name: editName.trim(),
        p_description: editDesc.trim(),
        p_visibility: editVis,
        p_icon_url: iconPath,
        p_soft_delete: false,
      });
      if (error) throw new Error(error.message);
      setSettingsOpen(false);
      setEditIcon(null);
      pushToast({ title: "Orbit settings saved", variant: "success" });
      await loadOrbitData();
    } catch (err) {
      pushToast({
        title: "Could not save Orbit settings",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteOrbit = async () => {
    if (!orbit || myRole !== "owner") return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("update_orbit_details", {
      p_orbit_id: orbit.id,
      p_name: orbit.name,
      p_description: orbit.description,
      p_visibility: orbit.visibility,
      p_icon_url: orbit.icon_url,
      p_soft_delete: true,
    });
    if (error) {
      pushToast({
        title: "Could not delete Orbit",
        description: error.message,
        variant: "error",
      });
      return;
    }
    pushToast({ title: "Orbit deleted", variant: "success" });
    router.replace("/app/orbits");
  };

  const handleLeaveOrbit = async () => {
    if (!orbit) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("leave_orbit", {
      p_orbit_id: orbit.id,
    });
    if (error) {
      pushToast({
        title: "Could not leave Orbit",
        description: error.message,
        variant: "error",
      });
      return;
    }
    pushToast({ title: `Left ${orbit.name}`, variant: "success" });
    router.replace("/app/orbits");
  };

  const handleJoinPublicOrbit = async () => {
    if (!orbit || joiningPublic) return;
    setJoiningPublic(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("join_orbit", {
      p_orbit_id: orbit.id,
    });
    setJoiningPublic(false);
    if (error) {
      pushToast({
        title: "Could not join Orbit",
        description: error.message,
        variant: "error",
      });
      return;
    }
    await loadOrbitData();
  };

  if (loadingOrbit) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!orbit || unavailableReason) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-8">
          <Lock className="mx-auto h-7 w-7 text-zinc-400" />
          <h1 className="text-lg font-semibold text-white">
            Orbit unavailable
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {unavailableReason}
          </p>
          <Link
            href="/app/orbits"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-zinc-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Orbits
          </Link>
        </div>
      </div>
    );
  }

  if (!myMember) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-7 space-y-4">
          <Avatar
            name={orbit.name}
            avatarPath={orbit.icon_url}
            size="xl"
            isGroup
            className="mx-auto"
          />
          <div>
            <h1 className="text-xl font-semibold text-white">{orbit.name}</h1>
            <p className="font-mono text-xs text-zinc-500">@{orbit.slug}</p>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {orbit.description || "Join this Orbit to read channels and participate."}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link
              href="/app/orbits"
              className="rounded-xl border border-white/12 px-4 py-2 text-xs text-zinc-300 hover:text-white"
            >
              Back
            </Link>
            {orbit.visibility === "public" ? (
              <Button
                type="button"
                variant="primary"
                loading={joiningPublic}
                onClick={() => void handleJoinPublicOrbit()}
              >
                Join Orbit ({orbit.member_count} members)
              </Button>
            ) : (
              <span className="rounded-xl border border-white/10 bg-[var(--bg-elevated)] px-4 py-2 text-xs text-zinc-400">
                Invite required
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-canvas)]">
      {/* Left Channels Column (Desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border-subtle)] p-4 space-y-2">
          <Link
            href="/app/orbits"
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            All Orbits
          </Link>
          <div className="flex items-center gap-2.5 pt-1">
            <Avatar
              name={orbit.name}
              avatarPath={orbit.icon_url}
              size="md"
              isGroup
            />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">
                {orbit.name}
              </h1>
              <p className="font-mono text-[10px] text-zinc-500 truncate">
                @{orbit.slug} · {orbit.member_count} members
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Channels
            </span>
            {isModerator && (
              <button
                type="button"
                onClick={() => setNewChannelOpen(true)}
                aria-label="Create channel"
                className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {channels.map((ch) => {
            const active = activeChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannelId(ch.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                  active
                    ? "bg-white text-zinc-950 font-semibold"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                )}
              >
                {ch.is_announcement ? (
                  <Megaphone className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{ch.name}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-[var(--border-subtle)] p-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void handleLeaveOrbit()}
            className="text-[11px] text-zinc-400 hover:text-red-300 cursor-pointer"
          >
            Leave Orbit
          </button>
          <button
            type="button"
            onClick={() =>
              openReportModal({
                orbitId: orbit.id,
                label: `Orbit @${orbit.slug}`,
              })
            }
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 cursor-pointer"
          >
            <Flag className="h-3 w-3" />
            Report
          </button>
        </div>
      </aside>

      {/* Center Channel Stream */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Channel Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/app/orbits"
              aria-label="Back to Orbits"
              className="lg:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {activeChannel?.is_announcement ? (
                  <Megaphone className="h-4 w-4 text-zinc-300 shrink-0" />
                ) : (
                  <Hash className="h-4 w-4 text-zinc-300 shrink-0" />
                )}
                <h2 className="text-sm font-semibold text-white truncate">
                  {activeChannel?.name || "general"}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                  {orbit.visibility === "private" ? (
                    <Lock className="h-2.5 w-2.5" />
                  ) : (
                    <Globe className="h-2.5 w-2.5" />
                  )}
                  {orbit.name}
                </span>
              </div>
              {activeChannel?.topic && (
                <p className="text-[11px] text-zinc-500 truncate">
                  {activeChannel.topic}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isModerator && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Invite</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Orbit settings"
                  onClick={() => {
                    setEditName(orbit.name);
                    setEditDesc(orbit.description);
                    setEditVis(orbit.visibility);
                    setSettingsOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowMembersDrawer((v) => !v)}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{orbit.member_count}</span>
            </Button>
          </div>
        </header>

        {/* Mobile Horizontal Channel Switcher */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 py-2">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setActiveChannelId(ch.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs shrink-0 cursor-pointer",
                activeChannel?.id === ch.id
                  ? "bg-white text-zinc-950 font-semibold"
                  : "border border-white/10 text-zinc-400"
              )}
            >
              #{ch.name}
            </button>
          ))}
          {isModerator && (
            <button
              type="button"
              onClick={() => setNewChannelOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-xs text-zinc-300 shrink-0"
            >
              <Plus className="h-3 w-3" />
              Channel
            </button>
          )}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-3">
          {hasOlderMessages && (
            <div className="flex justify-center pb-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={loadingOlder}
                onClick={() => void handleLoadOlder()}
              >
                Load earlier messages
              </Button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-medium text-white">
                Start the conversation in #{activeChannel?.name}
              </p>
              <p className="text-xs text-zinc-500">
                Messages in this Orbit are synced live for authorized community
                members.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.kind === "system") {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center py-1"
                  >
                    <span className="rounded-full border border-white/10 bg-[var(--bg-surface)] px-3 py-1 font-mono text-[11px] text-zinc-400">
                      {msg.body}
                    </span>
                  </div>
                );
              }

              if (msg.sender_id && isBlockedByMe(msg.sender_id)) {
                return null;
              }

              const sender = msg.sender_id
                ? profilesById[msg.sender_id]
                : null;
              const isMine = msg.sender_id === user?.id;
              const isDeleted = Boolean(msg.deleted_at);
              const canDelete = !isDeleted && (isMine || isModerator);

              return (
                <div
                  key={msg.id}
                  className="group flex items-start gap-3 rounded-2xl border border-transparent px-3 py-2.5 hover:border-white/[0.06] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <Avatar
                    name={sender?.display_name || "Member"}
                    avatarPath={sender?.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {sender?.display_name || "Member"}
                        </span>
                        {sender?.username && (
                          <span className="font-mono text-[11px] text-zinc-500 truncate">
                            @{sender.username}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-zinc-500">
                          {formatMessageTime(msg.created_at)}
                        </span>
                        {msg.edited_at && !isDeleted && (
                          <span className="font-mono text-[10px] text-zinc-500">
                            (edited)
                          </span>
                        )}
                      </div>

                      {!isDeleted && (
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {isMine && (
                            <button
                              type="button"
                              aria-label="Edit message"
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditingBody(msg.body);
                              }}
                              className="rounded-lg p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-white cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              aria-label="Delete message"
                              onClick={() => void handleDeleteMessage(msg.id)}
                              className="rounded-lg p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isDeleted ? (
                      <p className="text-xs italic text-zinc-500">
                        Message removed
                      </p>
                    ) : editingMessageId === msg.id ? (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value)}
                          maxLength={4000}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => void handleSaveEditMessage(msg.id)}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMessageId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.body && (
                          <p className="whitespace-pre-wrap break-words text-sm text-zinc-200 leading-relaxed">
                            {msg.body}
                          </p>
                        )}
                        {msg.attachment_path && (
                          <div className="pt-1.5 max-w-sm">
                            {msg.attachment_mime?.startsWith("image/") ? (
                              <PrivateMediaImage
                                bucket="social-media"
                                path={msg.attachment_path}
                                alt={msg.attachment_name || "Attachment"}
                                className="max-h-72 w-auto"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const url = await resolveSignedUrl(
                                    "social-media",
                                    msg.attachment_path
                                  );
                                  if (url) {
                                    window.open(
                                      url,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }
                                }}
                                className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-[var(--bg-elevated)] px-3.5 py-2.5 text-left text-xs text-zinc-200 hover:border-white/25 cursor-pointer"
                              >
                                <Paperclip className="h-4 w-4 shrink-0 text-zinc-400" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {msg.attachment_name || "Document"}
                                  </p>
                                  {msg.attachment_size && (
                                    <p className="font-mono text-[10px] text-zinc-500">
                                      {formatByteSize(msg.attachment_size)}
                                    </p>
                                  )}
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 pb-safe">
          {!canPostInActiveChannel ? (
            <div className="rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-4 py-2.5 text-center text-xs text-zinc-400">
              Only Orbit owners and administrators can post in #
              {activeChannel?.name}.
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-2">
              {stagedFile && (
                <div className="flex items-center justify-between rounded-xl border border-white/12 bg-[var(--bg-elevated)] px-3 py-2 text-xs text-zinc-200">
                  <span className="truncate">
                    {stagedFile.name} ({formatByteSize(stagedFile.size)})
                    {uploadPercent !== null ? ` · ${uploadPercent}%` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStagedFile(null)}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <label
                  aria-label="Attach file"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[var(--bg-canvas)] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setStagedFile(e.target.files?.[0] || null)}
                  />
                </label>

                <input
                  type="text"
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder={`Message #${activeChannel?.name || "general"}`}
                  maxLength={4000}
                  className="h-10 flex-1 rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                />

                <Button
                  type="submit"
                  variant="primary"
                  loading={sending}
                  disabled={!composerBody.trim() && !stagedFile}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </footer>
      </section>

      {/* Right Members & Governance Drawer */}
      {showMembersDrawer && (
        <aside className="w-72 shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
              Members ({orbit.member_count})
            </h3>
            <button
              type="button"
              onClick={() => setShowMembersDrawer(false)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {members
              .filter((m) => m.status === "active")
              .map((m) => {
                const prof = m.profile;
                const canModThisMember =
                  isModerator &&
                  m.user_id !== user?.id &&
                  m.role !== "owner" &&
                  (myRole === "owner" || m.role !== "admin");

                return (
                  <div
                    key={m.user_id}
                    className="rounded-xl border border-white/[0.06] bg-[var(--bg-canvas)] p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={prof?.display_name || "Member"}
                          avatarPath={prof?.avatar_url}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {prof?.display_name || "Member"}
                          </p>
                          <p className="font-mono text-[10px] text-zinc-500 truncate">
                            @{prof?.username || "member"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-300">
                        {m.role}
                      </span>
                    </div>

                    {canModThisMember && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
                        {myRole === "owner" && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleModerateMember(
                                m.user_id,
                                "set_role",
                                m.role === "admin" ? "member" : "admin"
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer"
                          >
                            <Shield className="h-2.5 w-2.5" />
                            {m.role === "admin" ? "Demote" : "Make Admin"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void handleModerateMember(m.user_id, "kick")
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-red-300 cursor-pointer"
                        >
                          <UserMinus className="h-2.5 w-2.5" />
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleModerateMember(m.user_id, "ban")
                          }
                          className="rounded-md border border-red-500/25 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10 cursor-pointer"
                        >
                          Ban
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </aside>
      )}

      {/* New Channel Modal */}
      <Dialog
        open={newChannelOpen}
        onClose={() => setNewChannelOpen(false)}
        title="Create Orbit channel"
        description={`Add a topic channel inside ${orbit.name}.`}
      >
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <Input
            label="Channel name"
            placeholder="design-critique"
            value={chanName}
            onChange={(e) => setChanName(e.target.value)}
            maxLength={50}
            required
          />
          <Input
            label="Topic (optional)"
            placeholder="Share work in progress and feedback"
            value={chanTopic}
            onChange={(e) => setChanTopic(e.target.value)}
            maxLength={240}
          />
          <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={chanAnnouncement}
              onChange={(e) => setChanAnnouncement(e.target.checked)}
              className="rounded border-white/20"
            />
            <span>Announcement channel (only owners & admins can post)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setNewChannelOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingChan}>
              Create channel
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Invite Members Modal */}
      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={`Add members to ${orbit.name}`}
        description="Search accounts to add directly to this Orbit."
      >
        <div className="space-y-3">
          <Input
            placeholder="Search @username or display name..."
            value={inviteQuery}
            onChange={(e) => setInviteQuery(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {inviteResults.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No matching accounts available to add.
              </p>
            ) : (
              inviteResults.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={p.display_name}
                      avatarPath={p.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {p.display_name}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500 truncate">
                        @{p.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleInviteMember(p.id)}
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Dialog>

      {/* Orbit Settings Modal */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Orbit governance & settings"
        description={`Manage @${orbit.slug} details and visibility.`}
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <Input
            label="Orbit name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={80}
            required
          />
          <Textarea
            label="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            maxLength={500}
          />
          <div className="grid grid-cols-2 gap-2">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setEditVis(v)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-medium capitalize cursor-pointer",
                  editVis === v
                    ? "border-white bg-white text-zinc-950"
                    : "border-white/10 text-zinc-400"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-1.5 text-xs text-zinc-300 cursor-pointer">
            <span>{editIcon ? editIcon.name : "Change Orbit icon"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => setEditIcon(e.target.files?.[0] || null)}
            />
          </label>
          <div className="flex items-center justify-between pt-2">
            {myRole === "owner" ? (
              <button
                type="button"
                onClick={() => void handleDeleteOrbit()}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Delete Orbit
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={savingSettings}>
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
