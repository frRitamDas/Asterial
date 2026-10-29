"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Contact2,
  Flame,
  MessageSquare,
  Orbit,
  Search,
  Settings,
  UserRound,
  WifiOff,
} from "lucide-react";
import { AsterialMark } from "@/components/brand/AsterialLogo";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ConversationSidebar } from "@/components/workspace/ConversationSidebar";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    profile,
    totalUnreadCount,
    isNetworkOnline,
    setActiveModal,
  } = useWorkspace();

  const isInSpecificChat = /^\/app\/chats\/[^/]+/.test(pathname);
  const isChatsSection = pathname.startsWith("/app/chats");

  const primaryDestinations = [
    {
      href: "/app/chats",
      label: "Chats",
      icon: MessageSquare,
      active: pathname.startsWith("/app/chats") || pathname.startsWith("/app/groups"),
      badge: totalUnreadCount,
    },
    {
      href: "/app/orbits",
      label: "Orbits",
      icon: Orbit,
      active: pathname.startsWith("/app/orbits"),
      badge: 0,
    },
    {
      href: "/app/moments",
      label: "Moments",
      icon: Flame,
      active: pathname.startsWith("/app/moments"),
      badge: 0,
    },
    {
      href: "/app/feed",
      label: "Feed",
      icon: Compass,
      active: pathname.startsWith("/app/feed"),
      badge: 0,
    },
    {
      href: "/app/contacts",
      label: "Discover",
      icon: Contact2,
      active: pathname.startsWith("/app/contacts"),
      badge: 0,
    },
    {
      href: "/app/settings",
      label: "Settings",
      icon: Settings,
      active:
        pathname.startsWith("/app/settings") ||
        pathname.startsWith("/app/profile"),
      badge: 0,
    },
  ];

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Offline / Reconnecting Banner */}
      {!isNetworkOnline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/12 px-4 py-1.5 text-xs text-amber-200 shrink-0"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Connection interrupted — messages will remain in pending/retry state
            until network connectivity returns.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Navigation Rail */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] py-4"
        >
          <div className="flex flex-col items-center gap-2.5">
            <Link
              href="/app/chats"
              aria-label="ASTERIAL Home"
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors"
            >
              <AsterialMark className="h-5 w-5" />
            </Link>

            {primaryDestinations.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                    item.active
                      ? "bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.badge > 0 && (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold border",
                        item.active
                          ? "bg-[var(--bg-void)] text-[var(--text-primary)] border-[var(--border-strong)]"
                          : "bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-[var(--bg-void)]"
                      )}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveModal("search")}
              title="Unified Search (⌘K)"
              aria-label="Unified Search"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <Link
              href="/app/settings"
              title="Settings"
              aria-label="Settings"
              aria-current={pathname.startsWith("/app/settings") ? "page" : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                pathname.startsWith("/app/settings")
                  ? "bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
              )}
            >
              <Settings className="h-4.5 w-4.5" />
            </Link>

            <Link
              href="/app/profile"
              title={
                profile
                  ? `${profile.display_name} (@${profile.username})`
                  : "Profile"
              }
              aria-label="Your profile"
              className={cn(
                "rounded-full p-0.5 transition-all",
                pathname.startsWith("/app/profile")
                  ? "ring-2 ring-[var(--accent-primary)]"
                  : "opacity-90 hover:opacity-100"
              )}
            >
              {profile ? (
                <Avatar
                  name={profile.display_name}
                  avatarPath={profile.avatar_url}
                  size="sm"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                  <UserRound className="h-4 w-4 text-zinc-300" />
                </div>
              )}
            </Link>
          </div>
        </nav>

        {/* Conversation Sidebar Pane */}
        <ConversationSidebar
          className={cn(
            "w-full md:w-80 lg:w-[348px] shrink-0",
            isChatsSection
              ? isInSpecificChat
                ? "hidden md:flex"
                : "flex"
              : "hidden lg:flex"
          )}
        />

        {/* Active Workspace Pane */}
        <main
          className={cn(
            "flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--bg-canvas)]",
            pathname === "/app/chats" ? "hidden md:flex" : "flex"
          )}
        >
          {children}
        </main>
      </div>

      {/* Dedicated Mobile Bottom Navigation (hidden inside active full-screen chat view) */}
      {!isInSpecificChat && (
        <nav
          aria-label="Mobile navigation"
          className="flex md:hidden items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1 py-1.5 pb-safe shrink-0"
        >
          {primaryDestinations.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-colors",
                  item.active
                    ? "text-[var(--accent-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="relative">
                  <Icon className="h-4.5 w-4.5" />
                  {item.badge > 0 && (
                    <span className="absolute -right-2 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 font-mono text-[9px] font-bold text-[var(--accent-primary-fg)]">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <WorkspaceModals />
    </div>
  );
}
