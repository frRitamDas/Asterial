import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  THEME_PALETTES,
  parseAuthDeepLink,
  sortConversationSummaries,
  type AppearanceTheme,
  type ConversationMemberRow,
  type ConversationRow,
  type ConversationSummary,
  type MessageDensity,
  type NotificationPreferencesRow,
  type ProfileRow,
  type ReportReason,
  type ThemePalette,
} from "@asterial/core";
import { AsterialNative, type InstalledAndroidAppInfo } from "../native/AsterialNative";
import {
  clearSignedUrlCache,
  primePrivateSignedUrls,
} from "../lib/storage";
import {
  clearPersistedAuthSession,
  ensureMobileSupabaseClient,
} from "../lib/supabase";

const LOCAL_APPEARANCE_CACHE_KEY = "@asterial/appearance-cache-v1";
const INBOX_PAGE_STEP = 30;

export type MobileBootStatus =
  | "booting"
  | "unconfigured"
  | "signed_out"
  | "password_recovery"
  | "onboarding"
  | "ready";

interface ToastMessage {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

export interface MobileWorkspaceContextValue {
  supabase: SupabaseClient | null;
  bootStatus: MobileBootStatus;
  user: User | null;
  profile: ProfileRow | null;
  preferences: NotificationPreferencesRow | null;
  theme: AppearanceTheme;
  palette: ThemePalette;
  density: MessageDensity;
  reducedMotion: boolean;
  conversations: ConversationSummary[];
  inboxLoading: boolean;
  hasMoreConversations: boolean;
  onlineUserIds: Set<string>;
  blockedIds: Set<string>;
  isOnline: boolean;
  installedAppInfo: InstalledAndroidAppInfo | null;
  sessionNotice: string | null;
  toast: ToastMessage | null;
  clearSessionNotice: () => void;
  showToast: (text: string, kind?: "info" | "success" | "error") => void;
  dismissToast: () => void;
  exitPasswordRecovery: () => void;
  retryBootstrap: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  toggleConversationPin: (
    conversationId: string,
    nextPinned: boolean
  ) => Promise<void>;
  toggleConversationMute: (
    conversationId: string,
    nextMuted: boolean
  ) => Promise<void>;
  toggleConversationArchive: (
    conversationId: string,
    nextArchived: boolean
  ) => Promise<void>;
  startDirectChat: (targetUserId: string) => Promise<string>;
  createGroupChat: (
    name: string,
    description: string,
    memberIds: string[]
  ) => Promise<string>;
  toggleBlockUser: (targetUserId: string) => Promise<boolean>;
  submitReport: (params: {
    reportedUserId?: string | null;
    reportedMessageId?: string | null;
    conversationId?: string | null;
    orbitId?: string | null;
    postId?: string | null;
    momentId?: string | null;
    reason: ReportReason;
    details: string;
  }) => Promise<void>;
  updateAppearancePreferences: (
    patch: Partial<NotificationPreferencesRow>
  ) => Promise<void>;
  updateProfileRecord: (patch: Partial<ProfileRow>) => Promise<void>;
  signOut: () => Promise<void>;
  deleteOwnAccount: () => Promise<void>;
}

const MobileWorkspaceContext = createContext<MobileWorkspaceContextValue | null>(
  null
);

export function MobileWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [bootStatus, setBootStatus] = useState<MobileBootStatus>("booting");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferencesRow | null>(null);
  const [cachedTheme, setCachedTheme] = useState<AppearanceTheme>("obsidian");
  const [cachedDensity, setCachedDensity] =
    useState<MessageDensity>("comfortable");

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [inboxLimit, setInboxLimit] = useState<number>(INBOX_PAGE_STEP);
  const [hasMoreConversations, setHasMoreConversations] =
    useState<boolean>(false);
  const [inboxLoading, setInboxLoading] = useState<boolean>(false);

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [installedAppInfo, setInstalledAppInfo] =
    useState<InstalledAndroidAppInfo | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [inRecoveryFlow, setInRecoveryFlow] = useState<boolean>(false);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledDeepLinksRef = useRef<Set<string>>(new Set());

  const showToast = useCallback(
    (text: string, kind: "info" | "success" | "error" = "info") => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const id = Date.now();
      setToast({ id, kind, text });
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 3600);
    },
    []
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  const exitPasswordRecovery = useCallback(() => {
    setInRecoveryFlow(false);
  }, []);

  const hydrateUserWorkspace = useCallback(
    async (
      client: SupabaseClient,
      authUser: User,
      targetLimit: number
    ): Promise<ProfileRow | null> => {
      setInboxLoading(true);
      try {
        const uid = authUser.id;
        const [profileRes, prefRes, blocksRes, myMembershipsRes] =
          await Promise.all([
            client.from("profiles").select("*").eq("id", uid).maybeSingle(),
            client
              .from("notification_preferences")
              .select("*")
              .eq("user_id", uid)
              .maybeSingle(),
            client
              .from("user_blocks")
              .select("blocked_id")
              .eq("blocker_id", uid),
            client
              .from("conversation_members")
              .select("*")
              .eq("user_id", uid)
              .is("left_at", null)
              .order("pinned", { ascending: false })
              .order("joined_at", { ascending: false })
              .limit(targetLimit + 1),
          ]);

        const nextProfile = (profileRes.data as ProfileRow | null) ?? null;
        const nextPrefs =
          (prefRes.data as NotificationPreferencesRow | null) ?? null;
        setProfile(nextProfile);
        setPreferences(nextPrefs);

        if (nextPrefs) {
          setCachedTheme(nextPrefs.appearance_theme);
          setCachedDensity(nextPrefs.message_density);
          void AsyncStorage.setItem(
            LOCAL_APPEARANCE_CACHE_KEY,
            JSON.stringify({
              theme: nextPrefs.appearance_theme,
              density: nextPrefs.message_density,
            })
          );
        }

        const nextBlocked = new Set<string>(
          (blocksRes.data || []).map(
            (b: { blocked_id: string }) => b.blocked_id
          )
        );
        setBlockedIds(nextBlocked);

        const rawMemberships = (myMembershipsRes.data ||
          []) as ConversationMemberRow[];
        setHasMoreConversations(rawMemberships.length > targetLimit);
        const memberships = rawMemberships.slice(0, targetLimit);

        if (memberships.length === 0) {
          setConversations([]);
          if (nextProfile?.avatar_url) {
            await primePrivateSignedUrls(client, "avatars", [
              nextProfile.avatar_url,
            ]);
          }
          return nextProfile;
        }

        const convIds = memberships.map((m) => m.conversation_id);
        const [convsRes, allMembersRes] = await Promise.all([
          client.from("conversations").select("*").in("id", convIds),
          client
            .from("conversation_members")
            .select("*")
            .in("conversation_id", convIds)
            .is("left_at", null),
        ]);

        const convMap = new Map<string, ConversationRow>();
        for (const c of (convsRes.data || []) as ConversationRow[]) {
          convMap.set(c.id, c);
        }

        const membersByConv = new Map<string, ConversationMemberRow[]>();
        const peerIds = new Set<string>();
        for (const m of (allMembersRes.data || []) as ConversationMemberRow[]) {
          const arr = membersByConv.get(m.conversation_id) || [];
          arr.push(m);
          membersByConv.set(m.conversation_id, arr);
          if (m.user_id !== uid) {
            peerIds.add(m.user_id);
          }
        }

        const peerIdArray = Array.from(peerIds);
        const peerProfileMap = new Map<string, ProfileRow>();
        const peerPresenceMap = new Map<string, string | null>();

        if (peerIdArray.length > 0) {
          const [peerProfilesRes, peerPresenceRes] = await Promise.all([
            client.from("profiles").select("*").in("id", peerIdArray),
            client
              .from("user_presence_state")
              .select("user_id, last_seen_at")
              .in("user_id", peerIdArray),
          ]);
          for (const p of (peerProfilesRes.data || []) as ProfileRow[]) {
            peerProfileMap.set(p.id, p);
          }
          for (const pr of (peerPresenceRes.data || []) as {
            user_id: string;
            last_seen_at: string | null;
          }[]) {
            peerPresenceMap.set(pr.user_id, pr.last_seen_at);
          }
        }

        const avatarPathsToPrime: (string | null | undefined)[] = [
          nextProfile?.avatar_url,
        ];
        const summaries: ConversationSummary[] = [];

        for (const myMem of memberships) {
          const conv = convMap.get(myMem.conversation_id);
          if (!conv) continue;
          const activeMembers = membersByConv.get(conv.id) || [myMem];
          let peerProfile: ProfileRow | null = null;
          let peerLastSeenAt: string | null = null;

          if (conv.type === "direct") {
            const peerMem = activeMembers.find((m) => m.user_id !== uid);
            if (peerMem) {
              peerProfile = peerProfileMap.get(peerMem.user_id) || null;
              peerLastSeenAt = peerPresenceMap.get(peerMem.user_id) || null;
            }
          }

          const displayTitle =
            conv.type === "group"
              ? conv.name || "Untitled Group"
              : peerProfile?.display_name ||
                peerProfile?.username ||
                "Asterial User";

          const displaySubtitle =
            conv.type === "group"
              ? `${activeMembers.length} ${
                  activeMembers.length === 1 ? "member" : "members"
                }`
              : peerProfile?.username
              ? `@${peerProfile.username}`
              : "Direct chat";

          const displayAvatarPath =
            conv.type === "group"
              ? conv.avatar_url
              : peerProfile?.avatar_url || null;

          avatarPathsToPrime.push(displayAvatarPath);

          summaries.push({
            conversation: conv,
            membership: myMem,
            peerProfile,
            peerLastSeenAt,
            memberCount: activeMembers.length,
            displayTitle,
            displaySubtitle,
            displayAvatarPath,
          });
        }

        await primePrivateSignedUrls(client, "avatars", avatarPathsToPrime);
        setConversations(sortConversationSummaries(summaries));
        return nextProfile;
      } finally {
        setInboxLoading(false);
      }
    },
    []
  );

  const processDeepLinkUrl = useCallback(
    async (client: SupabaseClient, url: string | null) => {
      if (!url || handledDeepLinksRef.current.has(url)) return;
      const parsed = parseAuthDeepLink(url);
      if (!parsed.recognized) return;

      handledDeepLinksRef.current.add(url);

      if (parsed.intent === "error") {
        setSessionNotice(parsed.errorMessage);
        return;
      }

      if (parsed.intent === "pkce_code") {
        const { error } = await client.auth.exchangeCodeForSession(parsed.code);
        if (error) {
          setSessionNotice(
            "This confirmation or recovery link has expired. Please request a fresh one."
          );
          return;
        }
        if (parsed.isRecovery) {
          setInRecoveryFlow(true);
          setBootStatus("password_recovery");
          showToast("Choose a new password for your account.", "info");
        } else {
          showToast("Email verified and signed in.", "success");
        }
        return;
      }

      if (parsed.intent === "otp_token_hash") {
        const { error } = await client.auth.verifyOtp({
          token_hash: parsed.tokenHash,
          type: parsed.otpType,
        });
        if (error) {
          setSessionNotice(
            "Verification link is invalid or has already been used."
          );
          return;
        }
        if (parsed.isRecovery) {
          setInRecoveryFlow(true);
          setBootStatus("password_recovery");
          showToast("Choose a new password for your account.", "info");
        } else {
          showToast("Email confirmed.", "success");
        }
        return;
      }

      if (parsed.intent === "session_tokens") {
        const { error } = await client.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) {
          setSessionNotice("Unable to restore session from callback link.");
          return;
        }
        if (parsed.isRecovery) {
          setInRecoveryFlow(true);
          setBootStatus("password_recovery");
        }
      }
    },
    [showToast]
  );

  const bootstrapApp = useCallback(async (forceRemoteRefresh = false) => {
    try {
      const [cachedAppearanceRaw, appInfo, onlineNow] = await Promise.all([
        AsyncStorage.getItem(LOCAL_APPEARANCE_CACHE_KEY).catch(() => null),
        AsterialNative.getInstalledAppInfo(),
        AsterialNative.getNetworkState(),
      ]);

      setInstalledAppInfo(appInfo);
      setIsOnline(onlineNow);

      if (cachedAppearanceRaw) {
        try {
          const parsed = JSON.parse(cachedAppearanceRaw) as {
            theme?: AppearanceTheme;
            density?: MessageDensity;
          };
          if (parsed.theme && THEME_PALETTES[parsed.theme]) {
            setCachedTheme(parsed.theme);
          }
          if (
            parsed.density === "compact" ||
            parsed.density === "comfortable"
          ) {
            setCachedDensity(parsed.density);
          }
        } catch {
          // Ignore invalid cache
        }
      }

      const client = await ensureMobileSupabaseClient({ forceRemoteRefresh });
      if (!client) {
        setSupabase(null);
        setBootStatus("unconfigured");
        return;
      }
      setSupabase(client);

      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        await processDeepLinkUrl(client, initialUrl);
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setBootStatus("signed_out");
        return;
      }

      // Verify restored token with Supabase Auth if device is online
      if (onlineNow) {
        const { data: verifiedUser, error: verifyErr } =
          await client.auth.getUser();
        if (verifyErr || !verifiedUser?.user) {
          await client.auth.signOut().catch(() => undefined);
          await clearPersistedAuthSession();
          clearSignedUrlCache();
          setUser(null);
          setProfile(null);
          setSessionNotice("Your session expired. Please sign in again.");
          setBootStatus("signed_out");
          return;
        }
      }

      setUser(session.user);
      const loadedProfile = await hydrateUserWorkspace(
        client,
        session.user,
        INBOX_PAGE_STEP
      );

      if (inRecoveryFlow) {
        setBootStatus("password_recovery");
      } else if (!loadedProfile || !loadedProfile.onboarding_completed) {
        setBootStatus("onboarding");
      } else {
        setBootStatus("ready");
      }
    } catch {
      setBootStatus("signed_out");
    }
  }, [hydrateUserWorkspace, inRecoveryFlow, processDeepLinkUrl]);

  useEffect(() => {
    const id = setTimeout(() => {
      void bootstrapApp();
    }, 0);
    return () => clearTimeout(id);
  }, [bootstrapApp]);

  // Listen to OS deep links & connectivity transitions
  useEffect(() => {
    const urlSub = Linking.addEventListener("url", (event) => {
      if (supabase) {
        void processDeepLinkUrl(supabase, event.url);
      }
    });

    const removeNetListener = AsterialNative.onNetworkStateChange((online) => {
      setIsOnline((prevOnline) => {
        if (!prevOnline && online && supabase && user) {
          void hydrateUserWorkspace(supabase, user, inboxLimit);
        }
        return online;
      });
    });

    return () => {
      urlSub.remove();
      removeNetListener();
    };
  }, [hydrateUserWorkspace, inboxLimit, processDeepLinkUrl, supabase, user]);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        setUser(session.user);
        setInRecoveryFlow(true);
        setBootStatus("password_recovery");
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        clearSignedUrlCache();
        setUser(null);
        setProfile(null);
        setPreferences(null);
        setConversations([]);
        setBlockedIds(new Set());
        setInRecoveryFlow(false);
        setBootStatus("signed_out");
        return;
      }

      setUser(session.user);
      void (async () => {
        const loadedProfile = await hydrateUserWorkspace(
          supabase,
          session.user,
          inboxLimit
        );
        if (inRecoveryFlow) {
          setBootStatus("password_recovery");
        } else if (!loadedProfile || !loadedProfile.onboarding_completed) {
          setBootStatus("onboarding");
        } else {
          setBootStatus("ready");
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hydrateUserWorkspace, inboxLimit, inRecoveryFlow, supabase]);

  // Global Presence & Heartbeat channel (100% shared protocol with Web)
  useEffect(() => {
    if (!supabase || !user?.id || bootStatus !== "ready") return;

    const sharePresence = profile?.presence_visibility !== "nobody";
    const presenceChannel = supabase.channel("asterial:presence", {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && sharePresence) {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    void supabase.rpc("touch_presence");
    const heartbeat = setInterval(() => {
      void supabase.rpc("touch_presence");
    }, 90_000);

    return () => {
      clearInterval(heartbeat);
      void supabase.removeChannel(presenceChannel);
    };
  }, [bootStatus, profile?.presence_visibility, supabase, user?.id]);

  const scheduleInboxRefresh = useCallback(() => {
    if (!supabase || !user) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void hydrateUserWorkspace(supabase, user, inboxLimit);
    }, 240);
  }, [hydrateUserWorkspace, inboxLimit, supabase, user]);

  // Realtime Workspace Channel (Conversations, Memberships, Delivery Receipts)
  useEffect(() => {
    if (!supabase || !user?.id || bootStatus !== "ready") return;

    const channel = supabase
      .channel(`asterial:workspace:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => scheduleInboxRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        () => scheduleInboxRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as {
            id?: string;
            conversation_id?: string;
            sender_id?: string | null;
          };
          if (
            newMsg?.conversation_id &&
            newMsg.sender_id &&
            newMsg.sender_id !== user.id
          ) {
            void supabase.rpc("acknowledge_delivery", {
              p_conversation_id: newMsg.conversation_id,
            });
          }
          scheduleInboxRefresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [bootStatus, scheduleInboxRefresh, supabase, user?.id]);

  const refreshWorkspace = useCallback(async () => {
    if (!supabase || !user) return;
    const loadedProfile = await hydrateUserWorkspace(supabase, user, inboxLimit);
    if (!loadedProfile || !loadedProfile.onboarding_completed) {
      setBootStatus("onboarding");
    } else if (!inRecoveryFlow) {
      setBootStatus("ready");
    }
  }, [hydrateUserWorkspace, inboxLimit, inRecoveryFlow, supabase, user]);

  const loadMoreConversations = useCallback(async () => {
    if (!supabase || !user || !hasMoreConversations || inboxLoading) return;
    const nextLimit = inboxLimit + INBOX_PAGE_STEP;
    setInboxLimit(nextLimit);
    await hydrateUserWorkspace(supabase, user, nextLimit);
  }, [
    hasMoreConversations,
    hydrateUserWorkspace,
    inboxLimit,
    inboxLoading,
    supabase,
    user,
  ]);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!supabase || !user) return;
      setConversations((prev) =>
        prev.map((item) =>
          item.conversation.id === conversationId
            ? {
                ...item,
                membership: { ...item.membership, unread_count: 0 },
              }
            : item
        )
      );
      await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });
    },
    [supabase, user]
  );

  const toggleConversationPin = useCallback(
    async (conversationId: string, nextPinned: boolean) => {
      if (!supabase || !user) return;
      const pinnedAt = nextPinned ? new Date().toISOString() : null;
      setConversations((prev) =>
        sortConversationSummaries(
          prev.map((c) =>
            c.conversation.id === conversationId
              ? {
                  ...c,
                  membership: {
                    ...c.membership,
                    pinned: nextPinned,
                    pinned_at: pinnedAt,
                  },
                }
              : c
          )
        )
      );
      const { error } = await supabase
        .from("conversation_members")
        .update({ pinned: nextPinned, pinned_at: pinnedAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      if (error) {
        showToast("Could not update pinned state.", "error");
        await refreshWorkspace();
      } else {
        showToast(nextPinned ? "Conversation pinned." : "Conversation unpinned.", "success");
      }
    },
    [refreshWorkspace, showToast, supabase, user]
  );

  const toggleConversationMute = useCallback(
    async (conversationId: string, nextMuted: boolean) => {
      if (!supabase || !user) return;
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
        .eq("user_id", user.id);
      if (error) {
        showToast("Could not update mute state.", "error");
        await refreshWorkspace();
      } else {
        showToast(
          nextMuted ? "Notifications muted." : "Notifications unmuted.",
          "info"
        );
      }
    },
    [refreshWorkspace, showToast, supabase, user]
  );

  const toggleConversationArchive = useCallback(
    async (conversationId: string, nextArchived: boolean) => {
      if (!supabase || !user) return;
      const archivedAt = nextArchived ? new Date().toISOString() : null;
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation.id === conversationId
            ? {
                ...c,
                membership: {
                  ...c.membership,
                  archived: nextArchived,
                  archived_at: archivedAt,
                },
              }
            : c
        )
      );
      const { error } = await supabase
        .from("conversation_members")
        .update({ archived: nextArchived, archived_at: archivedAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      if (error) {
        showToast("Could not update archive state.", "error");
        await refreshWorkspace();
      } else {
        showToast(
          nextArchived ? "Conversation archived." : "Restored to inbox.",
          "success"
        );
      }
    },
    [refreshWorkspace, showToast, supabase, user]
  );

  const startDirectChat = useCallback(
    async (targetUserId: string): Promise<string> => {
      if (!supabase) throw new Error("Workspace connection unavailable.");
      const { data, error } = await supabase.rpc(
        "create_or_get_direct_conversation",
        { p_target_user_id: targetUserId }
      );
      if (error || !data) {
        throw new Error(error?.message || "Could not start direct chat.");
      }
      await refreshWorkspace();
      return String(data);
    },
    [refreshWorkspace, supabase]
  );

  const createGroupChat = useCallback(
    async (
      name: string,
      description: string,
      memberIds: string[]
    ): Promise<string> => {
      if (!supabase) throw new Error("Workspace connection unavailable.");
      const { data, error } = await supabase.rpc("create_group_conversation", {
        p_name: name,
        p_description: description,
        p_member_ids: memberIds,
      });
      if (error || !data) {
        throw new Error(error?.message || "Could not create group.");
      }
      await refreshWorkspace();
      return String(data);
    },
    [refreshWorkspace, supabase]
  );

  const toggleBlockUser = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!supabase || !user) return false;
      const isBlocked = blockedIds.has(targetUserId);

      if (isBlocked) {
        const { error } = await supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", targetUserId);
        if (error) throw new Error(error.message);
        setBlockedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        showToast("User unblocked.", "info");
        return false;
      }

      const { error } = await supabase.from("user_blocks").insert({
        blocker_id: user.id,
        blocked_id: targetUserId,
      });
      if (error) throw new Error(error.message);
      setBlockedIds((prev) => {
        const next = new Set(prev);
        next.add(targetUserId);
        return next;
      });
      showToast("User blocked.", "info");
      return true;
    },
    [blockedIds, showToast, supabase, user]
  );

  const submitReport = useCallback(
    async (params: {
      reportedUserId?: string | null;
      reportedMessageId?: string | null;
      conversationId?: string | null;
      orbitId?: string | null;
      postId?: string | null;
      momentId?: string | null;
      reason: ReportReason;
      details: string;
    }) => {
      if (!supabase || !user) {
        throw new Error("Please sign in to submit a report.");
      }
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: params.reportedUserId ?? null,
        message_id: params.reportedMessageId ?? null,
        conversation_id: params.conversationId ?? null,
        orbit_id: params.orbitId ?? null,
        post_id: params.postId ?? null,
        moment_id: params.momentId ?? null,
        category: params.reason,
        details: params.details.trim(),
      });
      if (error) throw new Error(error.message);
      showToast("Report submitted for safety review.", "success");
    },
    [showToast, supabase, user]
  );

  const updateAppearancePreferences = useCallback(
    async (patch: Partial<NotificationPreferencesRow>) => {
      if (!supabase || !user) return;
      const merged: NotificationPreferencesRow = {
        user_id: user.id,
        in_app_enabled: preferences?.in_app_enabled ?? true,
        browser_enabled: preferences?.browser_enabled ?? false,
        sound_enabled: preferences?.sound_enabled ?? true,
        message_preview: preferences?.message_preview ?? true,
        dm_notifications: preferences?.dm_notifications ?? true,
        group_notifications: preferences?.group_notifications ?? true,
        appearance_theme: preferences?.appearance_theme ?? cachedTheme,
        message_density: preferences?.message_density ?? cachedDensity,
        reduced_motion: preferences?.reduced_motion ?? false,
        updated_at: new Date().toISOString(),
        ...patch,
      };
      setPreferences(merged);
      setCachedTheme(merged.appearance_theme);
      setCachedDensity(merged.message_density);

      await AsyncStorage.setItem(
        LOCAL_APPEARANCE_CACHE_KEY,
        JSON.stringify({
          theme: merged.appearance_theme,
          density: merged.message_density,
        })
      ).catch(() => undefined);

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(merged, { onConflict: "user_id" });
      if (error) {
        showToast("Could not save preference change.", "error");
      }
    },
    [cachedDensity, cachedTheme, preferences, showToast, supabase, user]
  );

  const updateProfileRecord = useCallback(
    async (patch: Partial<ProfileRow>) => {
      if (!supabase || !user) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      setProfile(data as ProfileRow);
    },
    [supabase, user]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut().catch(() => undefined);
    await clearPersistedAuthSession();
    clearSignedUrlCache();
    setUser(null);
    setProfile(null);
    setPreferences(null);
    setConversations([]);
    setBlockedIds(new Set());
    setBootStatus("signed_out");
  }, [supabase]);

  const deleteOwnAccount = useCallback(async () => {
    if (!supabase || !user) {
      throw new Error("Not authenticated.");
    }

    // Remove caller's private Storage objects first (mirrors src/app/api/account/delete/route.ts)
    const { data: myAttachments } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("uploader_id", user.id);

    if (profile?.avatar_url) {
      await supabase.storage
        .from("avatars")
        .remove([profile.avatar_url])
        .catch(() => undefined);
    }

    const attachmentPaths = (myAttachments || [])
      .map((a: { storage_path: string }) => a.storage_path)
      .filter(Boolean);
    if (attachmentPaths.length > 0) {
      await supabase.storage
        .from("chat-attachments")
        .remove(attachmentPaths)
        .catch(() => undefined);
    }

    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      throw new Error(error.message || "Account deletion failed.");
    }

    await supabase.auth.signOut().catch(() => undefined);
    await clearPersistedAuthSession();
    clearSignedUrlCache();
    setUser(null);
    setProfile(null);
    setPreferences(null);
    setConversations([]);
    setSessionNotice("Your account and messages have been permanently deleted.");
    setBootStatus("signed_out");
  }, [profile, supabase, user]);

  const theme: AppearanceTheme = preferences?.appearance_theme ?? cachedTheme;
  const palette: ThemePalette = THEME_PALETTES[theme] || THEME_PALETTES.obsidian;
  const density: MessageDensity =
    preferences?.message_density ?? cachedDensity;
  const reducedMotion: boolean = preferences?.reduced_motion ?? false;

  const value = useMemo<MobileWorkspaceContextValue>(
    () => ({
      supabase,
      bootStatus,
      user,
      profile,
      preferences,
      theme,
      palette,
      density,
      reducedMotion,
      conversations,
      inboxLoading,
      hasMoreConversations,
      onlineUserIds,
      blockedIds,
      isOnline,
      installedAppInfo,
      sessionNotice,
      toast,
      clearSessionNotice,
      showToast,
      dismissToast,
      exitPasswordRecovery,
      retryBootstrap: () => bootstrapApp(true),
      refreshWorkspace,
      loadMoreConversations,
      markConversationRead,
      toggleConversationPin,
      toggleConversationMute,
      toggleConversationArchive,
      startDirectChat,
      createGroupChat,
      toggleBlockUser,
      submitReport,
      updateAppearancePreferences,
      updateProfileRecord,
      signOut,
      deleteOwnAccount,
    }),
    [
      blockedIds,
      bootStatus,
      bootstrapApp,
      clearSessionNotice,
      conversations,
      createGroupChat,
      deleteOwnAccount,
      density,
      dismissToast,
      exitPasswordRecovery,
      hasMoreConversations,
      inboxLoading,
      installedAppInfo,
      isOnline,
      loadMoreConversations,
      markConversationRead,
      onlineUserIds,
      palette,
      preferences,
      profile,
      reducedMotion,
      refreshWorkspace,
      sessionNotice,
      showToast,
      signOut,
      startDirectChat,
      submitReport,
      supabase,
      theme,
      toast,
      toggleBlockUser,
      toggleConversationArchive,
      toggleConversationMute,
      toggleConversationPin,
      updateAppearancePreferences,
      updateProfileRecord,
      user,
    ]
  );

  return (
    <MobileWorkspaceContext.Provider value={value}>
      {children}
    </MobileWorkspaceContext.Provider>
  );
}

export function useMobileWorkspace(): MobileWorkspaceContextValue {
  const ctx = useContext(MobileWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useMobileWorkspace must be used inside MobileWorkspaceProvider."
    );
  }
  return ctx;
}
