"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Layers,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  UserCircle,
  WifiOff,
} from "lucide-react";
import { AsterialMark } from "@/components/brand/AsterialLogo";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ConversationSidebar } from "@/components/workspace/ConversationSidebar";
import { OnboardingModal } from "@/components/workspace/OnboardingModal";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { cn } from "@/lib/utils/cn";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

const NAV_ITEMS = [
  {
    href: "/app/chats",
    matchPrefix: "/app/chats",
    label: "Chats",
    icon: MessageSquare,
  },
  {
    href: "/app/groups",
    matchPrefix: "/app/groups",
    label: "Groups",
    icon: Layers,
  },
  {
    href: "/app/contacts",
    matchPrefix: "/app/contacts",
    label: "Contacts",
    icon: Compass,
  },
  {
    href: "/app/profile",
    matchPrefix: "/app/profile",
    label: "Profile",
    icon: UserCircle,
  },
  {
    href: "/app/settings",
    matchPrefix: "/app/settings",
    label: "Settings",
    icon: Settings,
  },
] as const;

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    profile,
    totalUnreadCount,
    isNetworkOnline,
    setActiveModal,
    signOut,
  } = useWorkspace();

  const isChatsSection = pathname.startsWith("/app/chats");
  const isActiveChatThread =
    pathname.startsWith("/app/chats/") && pathname !== "/app/chats";

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* Offline Reconnection Banner */}
      {!isNetworkOnline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Connection interrupted — ASTERIAL will automatically resynchronize
            once back online.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Primary Navigation Rail */}
        <nav
          aria-label="Workspace navigation"
          className="hidden md:flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] py-4"
        >
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/app/chats"
              title={`${ASTERIAL_BRAND.name} v${ASTERIAL_BRAND.version}`}
              className="rounded-xl p-1 hover:opacity-90 transition-opacity"
            >
              <AsterialMark size={34} />
            </Link>

            <button
              type="button"
              onClick={() => setActiveModal("search")}
              title="Search messages & chats (⌘K)"
              aria-label="Search messages and conversations"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>

            <div className="h-px w-7 bg-white/[0.08]" />

            <div className="flex flex-col items-center gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.matchPrefix);
                const showBadge =
                  item.href === "/app/chats" && totalUnreadCount > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-white text-zinc-950"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {showBadge && (
                      <span
                        className={cn(
                          "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold",
                          active
                            ? "bg-zinc-950 text-white ring-2 ring-white"
                            : "bg-white text-zinc-950"
                        )}
                      >
                        {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            {profile && (
              <Link
                href="/app/profile"
                title={`${profile.display_name} (@${profile.username})`}
              >
                <Avatar
                  name={profile.display_name}
                  avatarPath={profile.avatar_url}
                  size="sm"
                  online={isNetworkOnline && profile.presence_visibility !== "nobody"}
                  showPresence
                />
              </Link>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>

        {/* Dedicated Conversation Sidebar (Desktop on /app/chats/*; Mobile only on /app/chats) */}
        {isChatsSection && (
          <ConversationSidebar
            className={cn(
              "w-full md:w-[320px] lg:w-[340px] shrink-0",
              isActiveChatThread ? "hidden md:flex" : "flex"
            )}
          />
        )}

        {/* Main Workspace Panel */}
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-canvas)]",
            pathname === "/app/chats" ? "hidden md:flex" : "flex"
          )}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Hidden inside active full-screen chat view) */}
      {!isActiveChatThread && (
        <nav
          aria-label="Mobile navigation"
          className="flex md:hidden items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1.5"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.matchPrefix);
            const showBadge =
              item.href === "/app/chats" && totalUnreadCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label}</span>
                {showBadge && (
                  <span className="absolute right-1.5 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 font-mono text-[9px] font-bold text-zinc-950">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      <OnboardingModal />
      <WorkspaceModals />
    </div>
  );
}
