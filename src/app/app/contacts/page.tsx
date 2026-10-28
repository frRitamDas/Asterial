"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Compass,
  Flag,
  Loader2,
  MessageSquare,
  Search,
  Share2,
  UserCheck,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import { formatLastSeen } from "@/lib/utils/format";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import type { UserSearchResult } from "@/lib/types/database";

export default function ContactsPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const {
    profile,
    conversations,
    onlineUserIds,
    startDirectConversation,
    blockUser,
    unblockUser,
    isBlockedByMe,
    openReportModal,
  } = useWorkspace();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] =
    useState<UserSearchResult | null>(null);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.rpc("search_users", {
          p_query: query,
          p_limit: 30,
        });
        if (!active) return;
        const list = (data || []) as UserSearchResult[];
        void primeAvatarSignedUrls(list.map((u) => u.avatar_url));
        setResults(list);
      } finally {
        if (active) setResolvedQuery(query);
      }
    }, 240);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const loading = resolvedQuery !== query;

  const directPeers = conversations.filter(
    (c) => c.conversation.type === "direct" && c.peerProfile
  );

  const handleOpenChat = async (targetUserId: string) => {
    setStartingId(targetUserId);
    const convId = await startDirectConversation(targetUserId);
    setStartingId(null);
    if (convId) {
      setSelectedProfile(null);
      router.push(`/app/chats/${convId}`);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-subtle)] pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <Compass className="h-3.5 w-3.5 text-zinc-300" />
              <span>Directory &amp; Discovery</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              Contacts &amp; People
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Find anyone on ASTERIAL by @username or display name without
              exposing private emails.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const handleNote = profile?.username ? ` (@${profile.username})` : "";
              const shareText = `Connect with me${handleNote} on ${ASTERIAL_BRAND.name} — real-time messaging on Web & Android.`;
              try {
                if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                  await navigator.share({
                    title: `Join me on ${ASTERIAL_BRAND.name}`,
                    text: shareText,
                    url: ASTERIAL_BRAND.productionUrl,
                  });
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(`${shareText} ${ASTERIAL_BRAND.productionUrl}`);
                  pushToast({
                    title: "Invite link copied to clipboard",
                    variant: "success",
                  });
                }
              } catch {
                // User dismissed native share sheet
              }
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Invite to ASTERIAL
          </Button>
        </div>

        {/* Search Input */}
        <Input
          placeholder="Search by @username or display name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftAddon={<Search className="h-4 w-4" />}
        />

        {/* Existing Direct Connections (when search box is empty) */}
        {!query.trim() && directPeers.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Recent Direct Connections ({directPeers.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {directPeers.map((item) => {
                const peer = item.peerProfile!;
                const online = onlineUserIds.has(peer.id);
                return (
                  <div
                    key={item.conversation.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-3.5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={peer.display_name}
                        avatarPath={peer.avatar_url}
                        size="md"
                        online={online}
                        showPresence
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {peer.display_name}
                        </p>
                        <p className="truncate font-mono text-xs text-zinc-400">
                          @{peer.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        router.push(`/app/chats/${item.conversation.id}`)
                      }
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Directory Results */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            {query.trim() ? `Search Results` : `ASTERIAL Directory`}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-14 text-xs text-zinc-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching people...
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-10 text-center">
              <p className="text-sm font-medium text-white">
                {query.trim()
                  ? `No user found matching "${query.trim()}"`
                  : "No other accounts discovered yet"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {query.trim()
                  ? "Verify the spelling of their @username or display name."
                  : "Share ASTERIAL with teammates or friends to start connecting."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((person) => {
                const online = onlineUserIds.has(person.id);
                const blocked =
                  person.is_blocked_by_me || isBlockedByMe(person.id);
                const dmClosed = person.allow_direct_messages === "none";

                return (
                  <div
                    key={person.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-4 hover:border-white/20 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedProfile(person)}
                      className="flex items-start gap-3 text-left cursor-pointer"
                    >
                      <Avatar
                        name={person.display_name}
                        avatarPath={person.avatar_url}
                        size="lg"
                        online={online}
                        showPresence
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {person.display_name}
                          </p>
                          {blocked && (
                            <span className="rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="truncate font-mono text-xs text-zinc-400">
                          @{person.username}
                        </p>
                        {person.status_text && (
                          <p className="mt-1 truncate text-xs text-zinc-300">
                            {person.status_text}
                          </p>
                        )}
                        {person.bio && (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                            {person.bio}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                      <span className="font-mono text-[10px] text-zinc-500">
                        {online ? "Online" : formatLastSeen(person.last_seen_at)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedProfile(person)}
                        >
                          Profile
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={blocked || dmClosed}
                          loading={startingId === person.id}
                          onClick={() => void handleOpenChat(person.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {blocked
                            ? "Blocked"
                            : dmClosed
                              ? "DMs Off"
                              : "Message"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* User Profile Preview Modal */}
      <Dialog
        open={Boolean(selectedProfile)}
        onClose={() => setSelectedProfile(null)}
        title="Profile preview"
      >
        {selectedProfile && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                name={selectedProfile.display_name}
                avatarPath={selectedProfile.avatar_url}
                size="xl"
                online={onlineUserIds.has(selectedProfile.id)}
                showPresence
              />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">
                  {selectedProfile.display_name}
                </h3>
                <p className="font-mono text-xs text-zinc-400">
                  @{selectedProfile.username}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {onlineUserIds.has(selectedProfile.id)
                    ? "Online now"
                    : formatLastSeen(selectedProfile.last_seen_at)}
                </p>
              </div>
            </div>

            {selectedProfile.status_text && (
              <div className="rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs text-zinc-200">
                {selectedProfile.status_text}
              </div>
            )}

            {selectedProfile.bio && (
              <p className="text-xs text-zinc-300 leading-relaxed">
                {selectedProfile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-2">
                {isBlockedByMe(selectedProfile.id) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void unblockUser(selectedProfile.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Unblock
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void blockUser(selectedProfile.id)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Block
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const target = selectedProfile;
                    setSelectedProfile(null);
                    openReportModal({
                      reportedUserId: target.id,
                      label: `@${target.username}`,
                    });
                  }}
                >
                  <Flag className="h-3.5 w-3.5" />
                  Report
                </Button>
              </div>

              <Button
                size="sm"
                variant="primary"
                disabled={
                  isBlockedByMe(selectedProfile.id) ||
                  selectedProfile.allow_direct_messages === "none"
                }
                loading={startingId === selectedProfile.id}
                onClick={() => void handleOpenChat(selectedProfile.id)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Start conversation
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
