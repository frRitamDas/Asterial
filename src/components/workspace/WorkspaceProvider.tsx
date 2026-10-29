"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { resolveAppearanceTheme, type CloseOrbitContactItem, type CloseOrbitTier } from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import { authService, orbitsService } from "@/lib/services";
import { useToast } from "@/components/ui/Toast";
import type {
  ConversationMemberRow,
  ConversationRow,
  ConversationSummary,
  EnrichedMessage,
  NotificationPreferences,
  Profile,
  ReportCategory,
  UserBlockRow,
} from "@/lib/types/database";

interface ReportPayload {
  reportedUserId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  orbitId?: string | null;
  postId?: string | null;
  momentId?: string | null;
  category: ReportCategory;
  details: string;
}

export interface WorkspaceReportTarget {
  reportedUserId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  orbitId?: string | null;
  postId?: string | null;
  momentId?: string | null;
  label: string;
}

interface WorkspaceContextValue {
  user: User | null;
  profile: Profile | null;
  preferences: NotificationPreferences | null;
  conversations: ConversationSummary[];
  blocks: UserBlockRow[];
  blockedProfiles: Profile[];
  onlineUserIds: Set<string>;
  isNetworkOnline: boolean;
  loadingInitial: boolean;
  totalUnreadCount: number;
  activeModal: "new-dm" | "new-group" | "search" | null;
  reportTarget: WorkspaceReportTarget | null;
  forwardingMessage: EnrichedMessage | null;
  closeOrbitItems: CloseOrbitContactItem[];
  closeOrbitMap: Map<string, CloseOrbitContactItem>;
  drafts: Record<string, string>;
  setActiveModal: (modal: "new-dm" | "new-group" | "search" | null) => void;
  setForwardingMessage: (message: EnrichedMessage | null) => void;
  setDraft: (conversationId: string, body: string) => void;
  openReportModal: (target: WorkspaceReportTarget) => void;
  closeReportModal: () => void;
  refreshProfile: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshBlocks: () => Promise<void>;
  refreshCloseOrbit: () => Promise<void>;
  upsertCloseOrbit: (
    contactId: string,
    tier?: CloseOrbitTier,
    note?: string
  ) => Promise<boolean>;
  removeCloseOrbit: (contactId: string) => Promise<boolean>;
  updatePreferences: (
    patch: Partial<Omit<NotificationPreferences, "user_id" | "updated_at">>
  ) => Promise<void>;
  togglePin: (conversationId: string, nextPinned: boolean) => Promise<void>;
  toggleMute: (conversationId: string, nextMuted: boolean) => Promise<void>;
  toggleArchive: (
    conversationId: string,
    nextArchived: boolean
  ) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  startDirectConversation: (targetUserId: string) => Promise<string | null>;
  blockUser: (targetUserId: string, reason?: string) => Promise<boolean>;
  unblockUser: (targetUserId: string) => Promise<boolean>;
  isBlockedByMe: (targetUserId: string) => boolean;
  submitReport: (payload: ReportPayload) => Promise<boolean>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function playNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 250);
  } catch {
    // Ignore autoplay restrictions
  }
}

const EMPTY_ONLINE_SET = new Set<string>();

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pushToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [blocks, setBlocks] = useState<UserBlockRow[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<Profile[]>([]);
  const [rawOnlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [activeModal, setActiveModal] = useState<
    "new-dm" | "new-group" | "search" | null
  >(null);
  const [reportTarget, setReportTarget] = useState<WorkspaceReportTarget | null>(
    null
  );
  const [forwardingMessage, setForwardingMessage] =
    useState<EnrichedMessage | null>(null);
  const [closeOrbitItems, setCloseOrbitItems] = useState<
    CloseOrbitContactItem[]
  >([]);
  const [draftsState, setDraftsState] = useState<{
    uid: string | null;
    map: Record<string, string>;
  }>({ uid: null, map: {} });

  const drafts = useMemo(() => {
    if (!userId) return {};
    if (draftsState.uid === userId) return draftsState.map;
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(`asterial_drafts_v1:${userId}`);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }, [draftsState, userId]);

  const setDraft = useCallback(
    (conversationId: string, body: string) => {
      if (!userId) return;
      setDraftsState((prev) => {
        let base = prev.uid === userId ? prev.map : {};
        if (prev.uid !== userId && typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem(
              `asterial_drafts_v1:${userId}`
            );
            base = raw ? (JSON.parse(raw) as Record<string, string>) : {};
          } catch {
            base = {};
          }
        }
        const next = { ...base };
        if (body.trim().length > 0) {
          next[conversationId] = body;
        } else {
          delete next[conversationId];
        }
        try {
          window.localStorage.setItem(
            `asterial_drafts_v1:${userId}`,
            JSON.stringify(next)
          );
        } catch {
          // Ignore storage quota errors
        }
        return { uid: userId, map: next };
      });
    },
    [userId]
  );

  const prefsRef = useRef<NotificationPreferences | null>(null);
  const convsRef = useRef<ConversationSummary[]>([]);
  const pathnameRef = useRef<string>(pathname);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    prefsRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    convsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Apply appearance, accent, wallpaper & motion tokens to documentElement
  useEffect(() => {
    if (!preferences) return;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const applyTheme = () => {
      const resolved = resolveAppearanceTheme(
        preferences.appearance_theme,
        media.matches
      );
      root.setAttribute("data-theme", resolved);
      root.classList.toggle("dark", resolved !== "alabaster");
      root.setAttribute(
        "data-accent",
        preferences.accent_color || "indigo"
      );
      root.setAttribute(
        "data-wallpaper",
        preferences.chat_wallpaper || "constellation"
      );
      root.setAttribute(
        "data-density",
        preferences.message_density || "comfortable"
      );
      root.setAttribute(
        "data-reduced-motion",
        preferences.reduced_motion ? "true" : "false"
      );
    };

    applyTheme();
    if (preferences.appearance_theme === "system") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [preferences]);

  const fetchCloseOrbit = useCallback(async () => {
    try {
      const items = await orbitsService.fetchMyCloseOrbit();
      setCloseOrbitItems(items);
    } catch {
      // Keep prior Close Orbit snapshot if offline
    }
  }, []);

  const fetchProfileAndPrefs = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const [profileRes, prefsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as Profile;
      setProfile(p);
      void primeAvatarSignedUrls([p.avatar_url]);
    }

    if (prefsRes.data) {
      setPreferences(prefsRes.data as NotificationPreferences);
    } else {
      const { data: inserted } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: uid })
        .select("*")
        .maybeSingle();
      if (inserted) {
        setPreferences(inserted as NotificationPreferences);
      }
    }
  }, []);

  const fetchBlocks = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("user_blocks")
      .select("*")
      .eq("blocker_id", uid)
      .order("created_at", { ascending: false });

    const blockRows = (data || []) as UserBlockRow[];
    setBlocks(blockRows);

    if (blockRows.length === 0) {
      setBlockedProfiles([]);
      return;
    }

    const blockedIds = blockRows.map((b) => b.blocked_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .in("id", blockedIds);
    const list = (profs || []) as Profile[];
    void primeAvatarSignedUrls(list.map((p) => p.avatar_url));
    setBlockedProfiles(list);
  }, []);

  const fetchConversations = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();

    const { data: myMembershipsData, error: memErr } = await supabase
      .from("conversation_members")
      .select("*")
      .eq("user_id", uid)
      .is("left_at", null);

    if (memErr || !myMembershipsData || myMembershipsData.length === 0) {
      setConversations([]);
      return;
    }

    const myMemberships = myMembershipsData as ConversationMemberRow[];
    const convIds = myMemberships.map((m) => m.conversation_id);

    const [convsRes, allMembersRes] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase
        .from("conversation_members")
        .select("*")
        .in("conversation_id", convIds)
        .is("left_at", null),
    ]);

    const convRows = (convsRes.data || []) as ConversationRow[];
    const allMembers = (allMembersRes.data || []) as ConversationMemberRow[];

    const peerUserIds = Array.from(
      new Set(
        allMembers
          .filter((m) => m.user_id !== uid)
          .map((m) => m.user_id)
      )
    );

    const profileMap = new Map<string, Profile>();
    const presenceMap = new Map<string, string>();

    if (peerUserIds.length > 0) {
      const [peersRes, presenceRes] = await Promise.all([
        supabase.from("profiles").select("*").in("id", peerUserIds),
        supabase
          .from("user_presence_state")
          .select("user_id,last_seen_at")
          .in("user_id", peerUserIds),
      ]);

      for (const p of (peersRes.data || []) as Profile[]) {
        profileMap.set(p.id, p);
      }
      for (const pr of (presenceRes.data || []) as Array<{
        user_id: string;
        last_seen_at: string;
      }>) {
        presenceMap.set(pr.user_id, pr.last_seen_at);
      }
    }

    const convMap = new Map<string, ConversationRow>();
    for (const c of convRows) {
      convMap.set(c.id, c);
    }

    const membersByConv = new Map<string, ConversationMemberRow[]>();
    for (const m of allMembers) {
      const bucket = membersByConv.get(m.conversation_id) || [];
      bucket.push(m);
      membersByConv.set(m.conversation_id, bucket);
    }

    const avatarPathsToPrime: Array<string | null | undefined> = [];

    const summaries: ConversationSummary[] = [];
    for (const membership of myMemberships) {
      const conversation = convMap.get(membership.conversation_id);
      if (!conversation) continue;

      const convMembers = membersByConv.get(conversation.id) || [membership];
      let peerProfile: Profile | null = null;
      let peerLastSeenAt: string | null = null;

      if (conversation.type === "direct") {
        const peerMem = convMembers.find((m) => m.user_id !== uid);
        if (peerMem) {
          peerProfile = profileMap.get(peerMem.user_id) || null;
          peerLastSeenAt = presenceMap.get(peerMem.user_id) || null;
        }
      }

      const displayTitle =
        conversation.type === "group"
          ? conversation.name || "Untitled Group"
          : peerProfile?.display_name || "Deleted User";

      const displaySubtitle =
        conversation.type === "group"
          ? `${convMembers.length} ${convMembers.length === 1 ? "member" : "members"}`
          : peerProfile
            ? `@${peerProfile.username}`
            : "Account unavailable";

      const displayAvatarPath =
        conversation.type === "group"
          ? conversation.avatar_url
          : peerProfile?.avatar_url || null;

      avatarPathsToPrime.push(displayAvatarPath);

      summaries.push({
        conversation,
        membership,
        peerProfile,
        peerLastSeenAt,
        memberCount: convMembers.length,
        displayTitle,
        displaySubtitle,
        displayAvatarPath,
      });
    }

    // Sort: Pinned first (by pinned_at desc), then last_message_at / created_at desc
    summaries.sort((a, b) => {
      if (a.membership.pinned !== b.membership.pinned) {
        return a.membership.pinned ? -1 : 1;
      }
      const timeA = new Date(
        a.conversation.last_message_at || a.conversation.created_at
      ).getTime();
      const timeB = new Date(
        b.conversation.last_message_at || b.conversation.created_at
      ).getTime();
      return timeB - timeA;
    });

    void primeAvatarSignedUrls(avatarPathsToPrime);
    setConversations(summaries);
  }, []);

  const scheduleConversationsRefresh = useCallback(
    (uid: string) => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        void fetchConversations(uid);
      }, 140);
    },
    [fetchConversations]
  );

  // Initial session bootstrap & auth state listener
  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const bootstrap = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !authUser) {
          setLoadingInitial(false);
          router.replace(`/login?next=${encodeURIComponent(pathnameRef.current || "/app/chats")}`);
          return;
        }

        setUser(authUser);
        await Promise.all([
          fetchProfileAndPrefs(authUser.id),
          fetchConversations(authUser.id),
          fetchBlocks(authUser.id),
          fetchCloseOrbit(),
        ]);
        // Acknowledge delivery of any pending incoming messages
        void supabase.rpc("acknowledge_delivery", { p_conversation_id: null });
        void supabase.rpc("touch_presence");
      } catch {
        // Network offline during boot
      } finally {
        if (active) setLoadingInitial(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setProfile(null);
        setConversations([]);
        router.replace("/login");
      } else if (session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchBlocks, fetchCloseOrbit, fetchConversations, fetchProfileAndPrefs, router]);

  // Route un-onboarded users directly to the dedicated /onboarding flow
  useEffect(() => {
    if (
      !loadingInitial &&
      user &&
      profile &&
      profile.onboarding_completed === false &&
      pathname.startsWith("/app")
    ) {
      router.replace("/onboarding");
    }
  }, [loadingInitial, pathname, profile, router, user]);

  // Open requested workspace action from /onboarding or deep links
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "new-dm" || action === "new-group" || action === "search") {
      const timer = window.setTimeout(() => {
        setActiveModal(action);
      }, 0);
      params.delete("action");
      const nextSearch = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
      );
      return () => window.clearTimeout(timer);
    }
  }, [pathname]);

  // Network online/offline listeners + automatic catch-up on reconnect
  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOnline(true);
      if (userId) {
        void fetchConversations(userId);
        void getSupabaseBrowserClient().rpc("acknowledge_delivery", {
          p_conversation_id: null,
        });
        void getSupabaseBrowserClient().rpc("touch_presence");
      }
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchConversations, userId]);

  // Global Presence Channel + throttled touch_presence
  useEffect(() => {
    if (!userId || !profile) return;
    const supabase = getSupabaseBrowserClient();

    if (profile.presence_visibility === "nobody") {
      void supabase.rpc("touch_presence");
      return;
    }

    const presenceChannel = supabase.channel("asterial:presence", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    const syncPresence = () => {
      const state = presenceChannel.presenceState();
      const ids = new Set<string>(Object.keys(state));
      setOnlineUserIds(ids);
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void supabase.rpc("touch_presence");
      }
    }, 90_000);

    return () => {
      window.clearInterval(heartbeat);
      void supabase.removeChannel(presenceChannel);
    };
  }, [userId, profile]);

  // Global Workspace Realtime Postgres Changes (conversations, memberships, incoming message notifications)
  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const uid = user.id;

    const channel = supabase
      .channel(`asterial:workspace:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          scheduleConversationsRefresh(uid);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        () => {
          scheduleConversationsRefresh(uid);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string | null;
            kind: string;
            body: string;
            has_attachments: boolean;
          };

          scheduleConversationsRefresh(uid);

          if (!newMsg || newMsg.sender_id === uid || newMsg.kind !== "user") {
            return;
          }

          // Record real delivery receipt immediately
          void supabase.rpc("acknowledge_delivery", {
            p_conversation_id: newMsg.conversation_id,
          });

          const activeChatPath = `/app/chats/${newMsg.conversation_id}`;
          const isViewingThisChat =
            pathnameRef.current === activeChatPath &&
            document.visibilityState === "visible";

          if (isViewingThisChat) {
            return;
          }

          const prefs = prefsRef.current;
          const convSummary = convsRef.current.find(
            (c) => c.conversation.id === newMsg.conversation_id
          );

          if (convSummary?.membership.is_muted) {
            return;
          }

          if (prefs) {
            if (
              convSummary?.conversation.type === "direct" &&
              !prefs.dm_notifications
            ) {
              return;
            }
            if (
              convSummary?.conversation.type === "group" &&
              !prefs.group_notifications
            ) {
              return;
            }
          }

          let senderName = convSummary?.displayTitle || "New message";
          if (newMsg.sender_id) {
            const { data: senderProf } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", newMsg.sender_id)
              .maybeSingle();
            if (senderProf?.display_name) {
              senderName =
                convSummary?.conversation.type === "group"
                  ? `${senderProf.display_name} · ${convSummary.displayTitle}`
                  : senderProf.display_name;
            }
          }

          const showPreview = prefs ? prefs.message_preview : true;
          const previewText = showPreview
            ? newMsg.body.trim() ||
              (newMsg.has_attachments ? "Sent an attachment" : "New message")
            : "New message received";

          if (!prefs || prefs.sound_enabled) {
            playNotificationChime();
          }

          if (!prefs || prefs.in_app_enabled) {
            pushToast({
              title: senderName,
              description: previewText,
              variant: "message",
              onClick: () => {
                router.push(activeChatPath);
              },
            });
          }

          if (
            prefs?.browser_enabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            try {
              const browserNotif = new Notification(senderName, {
                body: previewText,
                icon: "/icon.svg",
                tag: `asterial-${newMsg.conversation_id}`,
              });
              browserNotif.onclick = () => {
                window.focus();
                router.push(activeChatPath);
                browserNotif.close();
              };
            } catch {
              // Ignore browser notification errors
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pushToast, router, scheduleConversationsRefresh, user?.id]);

  // Global keyboard shortcut Cmd/Ctrl + K for Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setActiveModal((prev) => (prev === "search" ? null : "search"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onlineUserIds =
    profile?.presence_visibility === "nobody"
      ? EMPTY_ONLINE_SET
      : rawOnlineUserIds;

  const refreshProfile = useCallback(async () => {
    if (userId) await fetchProfileAndPrefs(userId);
  }, [fetchProfileAndPrefs, userId]);

  const refreshConversations = useCallback(async () => {
    if (userId) await fetchConversations(userId);
  }, [fetchConversations, userId]);

  const refreshBlocks = useCallback(async () => {
    if (userId) await fetchBlocks(userId);
  }, [fetchBlocks, userId]);

  const refreshCloseOrbit = useCallback(async () => {
    if (userId) await fetchCloseOrbit();
  }, [fetchCloseOrbit, userId]);

  const upsertCloseOrbit = useCallback(
    async (
      contactId: string,
      tier: CloseOrbitTier = "inner",
      note = ""
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await orbitsService.upsertCloseOrbitContact({ contactId, tier, note });
        await fetchCloseOrbit();
        pushToast({
          title:
            tier === "inner"
              ? "Added to Inner Orbit"
              : "Added to Priority Orbit",
          description: "Visible only to you under private Orbit rules.",
          variant: "success",
        });
        return true;
      } catch (err) {
        pushToast({
          title: "Could not update Close Orbit",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "error",
        });
        return false;
      }
    },
    [fetchCloseOrbit, pushToast, userId]
  );

  const removeCloseOrbit = useCallback(
    async (contactId: string): Promise<boolean> => {
      if (!userId) return false;
      try {
        await orbitsService.removeCloseOrbitContact(contactId);
        setCloseOrbitItems((prev) =>
          prev.filter((item) => item.contact_id !== contactId)
        );
        pushToast({
          title: "Removed from Close Orbit",
          variant: "success",
        });
        return true;
      } catch (err) {
        pushToast({
          title: "Could not remove from Close Orbit",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "error",
        });
        return false;
      }
    },
    [pushToast, userId]
  );

  const closeOrbitMap = useMemo(
    () => new Map(closeOrbitItems.map((c) => [c.contact_id, c])),
    [closeOrbitItems]
  );

  const updatePreferences = useCallback(
    async (
      patch: Partial<Omit<NotificationPreferences, "user_id" | "updated_at">>
    ) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      const prev = preferences;
      if (prev) {
        setPreferences({ ...prev, ...patch });
      }
      const { data, error } = await supabase
        .from("notification_preferences")
        .update(patch)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();

      if (error) {
        if (prev) setPreferences(prev);
        pushToast({
          title: "Failed to save preference",
          description: error.message,
          variant: "error",
        });
      } else if (data) {
        setPreferences(data as NotificationPreferences);
      }
    },
    [preferences, pushToast, userId]
  );

  const togglePin = useCallback(
    async (conversationId: string, nextPinned: boolean) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation.id === conversationId
            ? {
                ...c,
                membership: {
                  ...c.membership,
                  pinned: nextPinned,
                  pinned_at: nextPinned ? new Date().toISOString() : null,
                },
              }
            : c
        )
      );
      const { error } = await supabase
        .from("conversation_members")
        .update({ pinned: nextPinned })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        pushToast({
          title: "Could not update pin state",
          description: error.message,
          variant: "error",
        });
      }
      await fetchConversations(userId);
    },
    [fetchConversations, pushToast, userId]
  );

  const toggleMute = useCallback(
    async (conversationId: string, nextMuted: boolean) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation.id === conversationId
            ? {
                ...c,
                membership: { ...c.membership, is_muted: nextMuted },
              }
            : c
        )
      );
      const { error } = await supabase
        .from("conversation_members")
        .update({ is_muted: nextMuted })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        pushToast({
          title: "Could not update mute state",
          description: error.message,
          variant: "error",
        });
        await fetchConversations(userId);
      }
    },
    [fetchConversations, pushToast, userId]
  );

  const toggleArchive = useCallback(
    async (conversationId: string, nextArchived: boolean) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation.id === conversationId
            ? {
                ...c,
                membership: {
                  ...c.membership,
                  archived: nextArchived,
                  archived_at: nextArchived ? new Date().toISOString() : null,
                },
              }
            : c
        )
      );
      const { error } = await supabase
        .from("conversation_members")
        .update({ archived: nextArchived })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        pushToast({
          title: "Could not update archive state",
          description: error.message,
          variant: "error",
        });
        await fetchConversations(userId);
      } else {
        pushToast({
          title: nextArchived
            ? "Conversation archived"
            : "Conversation restored",
          variant: "success",
        });
      }
    },
    [fetchConversations, pushToast, userId]
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!userId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation.id === conversationId
            ? {
                ...c,
                membership: { ...c.membership, unread_count: 0 },
              }
            : c
        )
      );
      const supabase = getSupabaseBrowserClient();
      await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });
    },
    [userId]
  );

  const startDirectConversation = useCallback(
    async (targetUserId: string): Promise<string | null> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc(
        "create_or_get_direct_conversation",
        { p_target_user_id: targetUserId }
      );
      if (error || !data) {
        pushToast({
          title: "Unable to start conversation",
          description: error?.message || "Please try again.",
          variant: "error",
        });
        return null;
      }
      if (userId) {
        await fetchConversations(userId);
      }
      return String(data);
    },
    [fetchConversations, pushToast, userId]
  );

  const blockUser = useCallback(
    async (targetUserId: string, reason = ""): Promise<boolean> => {
      if (!userId) return false;
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("user_blocks").upsert({
        blocker_id: userId,
        blocked_id: targetUserId,
        reason: reason.slice(0, 200),
      });
      if (error) {
        pushToast({
          title: "Could not block user",
          description: error.message,
          variant: "error",
        });
        return false;
      }
      await fetchBlocks(userId);
      pushToast({
        title: "Account blocked",
        description: "They can no longer message you directly.",
        variant: "success",
      });
      return true;
    },
    [fetchBlocks, pushToast, userId]
  );

  const unblockUser = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!userId) return false;
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", targetUserId);
      if (error) {
        pushToast({
          title: "Could not unblock user",
          description: error.message,
          variant: "error",
        });
        return false;
      }
      await fetchBlocks(userId);
      pushToast({
        title: "Account unblocked",
        variant: "success",
      });
      return true;
    },
    [fetchBlocks, pushToast, userId]
  );

  const isBlockedByMe = useCallback(
    (targetUserId: string) =>
      blocks.some((b) => b.blocked_id === targetUserId),
    [blocks]
  );

  const submitReport = useCallback(
    async (payload: ReportPayload): Promise<boolean> => {
      if (!userId) return false;
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId,
        reported_user_id: payload.reportedUserId || null,
        conversation_id: payload.conversationId || null,
        message_id: payload.messageId || null,
        orbit_id: payload.orbitId || null,
        post_id: payload.postId || null,
        moment_id: payload.momentId || null,
        category: payload.category,
        details: payload.details.trim().slice(0, 1000),
      });
      if (error) {
        pushToast({
          title: "Could not submit report",
          description: error.message,
          variant: "error",
        });
        return false;
      }
      pushToast({
        title: "Report submitted",
        description: "Thank you for helping keep ASTERIAL safe.",
        variant: "success",
      });
      return true;
    },
    [pushToast, userId]
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const signOutAllDevices = useCallback(async () => {
    try {
      await authService.signOut("global");
      pushToast({
        title: "Signed out of all devices",
        variant: "success",
      });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      pushToast({
        title: "Could not revoke all sessions",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    }
  }, [pushToast, router]);

  const totalUnreadCount = useMemo(
    () =>
      conversations
        .filter((c) => !c.membership.archived)
        .reduce((acc, c) => acc + (c.membership.unread_count || 0), 0),
    [conversations]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      user,
      profile,
      preferences,
      conversations,
      blocks,
      blockedProfiles,
      onlineUserIds,
      isNetworkOnline,
      loadingInitial,
      totalUnreadCount,
      activeModal,
      reportTarget,
      forwardingMessage,
      closeOrbitItems,
      closeOrbitMap,
      drafts,
      setActiveModal,
      setForwardingMessage,
      setDraft,
      openReportModal: setReportTarget,
      closeReportModal: () => setReportTarget(null),
      refreshProfile,
      refreshConversations,
      refreshBlocks,
      refreshCloseOrbit,
      upsertCloseOrbit,
      removeCloseOrbit,
      updatePreferences,
      togglePin,
      toggleMute,
      toggleArchive,
      markConversationRead,
      startDirectConversation,
      blockUser,
      unblockUser,
      isBlockedByMe,
      submitReport,
      signOut,
      signOutAllDevices,
    }),
    [
      activeModal,
      blockUser,
      blockedProfiles,
      blocks,
      closeOrbitItems,
      closeOrbitMap,
      conversations,
      drafts,
      forwardingMessage,
      isBlockedByMe,
      isNetworkOnline,
      loadingInitial,
      markConversationRead,
      onlineUserIds,
      preferences,
      profile,
      refreshBlocks,
      refreshCloseOrbit,
      refreshConversations,
      refreshProfile,
      removeCloseOrbit,
      reportTarget,
      setDraft,
      signOut,
      signOutAllDevices,
      startDirectConversation,
      submitReport,
      toggleArchive,
      toggleMute,
      togglePin,
      totalUnreadCount,
      unblockUser,
      updatePreferences,
      upsertCloseOrbit,
      user,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
