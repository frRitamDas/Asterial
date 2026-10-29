"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Flame,
  LogOut,
  MessageSquare,
  Orbit,
  Palette,
  Search,
  Settings,
  Shield,
  UserRound,
  Users,
  WifiOff,
} from "lucide-react";
import { AsterialMark } from "@/components/brand/AsterialLogo";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ConversationSidebar } from "@/components/workspace/ConversationSidebar";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export function ProfileMenuTrigger({
  align = "bottom-left",
  size = "sm",
}: {
  align?: "bottom-left" | "top-right";
  size?: "xs" | "sm";
}) {
  const pathname = usePathname();
  const { profile, signOut } = useWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const isActive =
    pathname.startsWith("/app/settings/profile") ||
    pathname.startsWith("/app/profile");

  const showOnlineDot = profile
    ? profile.presence_visibility !== "nobody"
    : false;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={
          profile
            ? `${profile.display_name} (@${profile.username})`
            : "Account & Settings"
        }
        aria-label="Account menu"
        aria-expanded={open}
        className={cn(
          "relative flex items-center justify-center rounded-full p-0.5 transition-all cursor-pointer",
          isActive || open
            ? "ring-2 ring-[var(--accent)]"
            : "hover:ring-2 hover:ring-[var(--border-strong)]"
        )}
      >
        {profile ? (
          <Avatar
            name={profile.display_name}
            avatarPath={profile.avatar_url}
            size={size}
            online={showOnlineDot}
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
            <UserRound className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "z-50 w-64 rounded-[16px] border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 shadow-2xl animate-asterial-in",
            align === "bottom-left"
              ? "fixed bottom-4 left-[76px]"
              : "absolute right-0 top-full mt-2"
          )}
        >
          {profile && (
            <div className="border-b border-[var(--border-subtle)] px-3 py-2.5 mb-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {profile.display_name}
              </p>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                @{profile.username}
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    profile.presence_visibility !== "nobody"
                      ? "bg-[var(--success)]"
                      : "bg-[var(--text-muted)]"
                  )}
                />
                <span>
                  {profile.presence_visibility !== "nobody"
                    ? "Active status visible"
                    : "Active status hidden"}
                </span>
              </div>
            </div>
          )}

          <Link
            href="/app/settings/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <UserRound className="h-4 w-4 text-[var(--text-secondary)]" />
            <span>Profile</span>
          </Link>

          <Link
            href="/app/settings/appearance"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Palette className="h-4 w-4 text-[var(--text-secondary)]" />
            <span>Appearance</span>
          </Link>

          <Link
            href="/app/settings/privacy"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Shield className="h-4 w-4 text-[var(--text-secondary)]" />
            <span>Privacy & Safety</span>
          </Link>

          <Link
            href="/app/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Settings className="h-4 w-4 text-[var(--text-secondary)]" />
            <span>All Settings</span>
          </Link>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileUtilityActions() {
  const { setActiveModal } = useWorkspace();
  return (
    <div className="flex md:hidden items-center gap-1.5">
      <button
        type="button"
        onClick={() => setActiveModal("search")}
        aria-label="Global Search"
        title="Search"
        className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        <Search className="h-4 w-4" />
      </button>
      <ProfileMenuTrigger align="top-right" size="xs" />
    </div>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    totalUnreadCount,
    isNetworkOnline,
    setActiveModal,
  } = useWorkspace();

  const isInSpecificChat = /^\/app\/chats\/[^/]+/.test(pathname);
  const isInSpecificOrbit = /^\/app\/orbits\/[^/]+/.test(pathname);
  const isFullScreenThreadOnMobile = isInSpecificChat || isInSpecificOrbit;
  const isChatsSection = pathname.startsWith("/app/chats");
  const isSettingsSection =
    pathname.startsWith("/app/settings") || pathname.startsWith("/app/profile");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveModal("search");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveModal]);

  // Strictly 5 primary destinations for mobile bottom navigation & top rail
  const primaryDestinations = [
    {
      href: "/app/chats",
      label: "Chats",
      icon: MessageSquare,
      active:
        pathname.startsWith("/app/chats") || pathname.startsWith("/app/groups"),
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
      href: "/app/people",
      label: "People",
      icon: Users,
      active:
        pathname.startsWith("/app/people") ||
        pathname.startsWith("/app/contacts"),
      badge: 0,
    },
  ];

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Offline / Reconnecting Banner */}
      {!isNetworkOnline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-[var(--warning)]/30 bg-[var(--warning)]/12 px-4 py-1.5 text-xs text-[var(--text-primary)] shrink-0"
        >
          <WifiOff className="h-3.5 w-3.5 text-[var(--warning)] shrink-0" />
          <span>
            Connection interrupted — outgoing messages wait in retry state until
            connectivity returns.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Zone 1: Left Primary Navigation Rail (64px tablet, 68px desktop >=1200px) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex w-[64px] xl:w-[68px] shrink-0 flex-col items-center justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] py-3.5"
        >
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/app/chats"
              aria-label="ASTERIAL Chats"
              title="ASTERIAL"
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              <AsterialMark size={24} />
            </Link>

            {primaryDestinations.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
                    item.active
                      ? "bg-[var(--accent)] text-[var(--accent-primary-fg)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.badge > 0 && (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold border",
                        item.active
                          ? "bg-[var(--bg-void)] text-[var(--text-primary)] border-[var(--border-strong)]"
                          : "bg-[var(--accent)] text-[var(--accent-primary-fg)] border-[var(--bg-void)]"
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
              title="Search (⌘K)"
              aria-label="Global Search"
              className="mt-1 flex h-10 w-10 items-center justify-center rounded-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <Link
              href="/app/settings"
              title="Settings"
              aria-label="Settings"
              aria-current={isSettingsSection ? "page" : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
                isSettingsSection
                  ? "bg-[var(--accent)] text-[var(--accent-primary-fg)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>

            <ProfileMenuTrigger align="bottom-left" size="sm" />
          </div>
        </nav>

        {/* Zone 2: Conversation / Channel List Panel (320-380px on desktop, full screen on mobile /app/chats) */}
        {!isSettingsSection && (
          <ConversationSidebar
            className={cn(
              "w-full md:w-[320px] lg:w-[340px] xl:w-[360px] shrink-0",
              isChatsSection
                ? isInSpecificChat
                  ? "hidden md:flex"
                  : "flex"
                : "hidden xl:flex"
            )}
          />
        )}

        {/* Zone 3: Main Conversation / Content Workspace */}
        <main
          className={cn(
            "flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--bg-canvas)]",
            pathname === "/app/chats" ? "hidden md:flex" : "flex"
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation: strictly 5 destinations, hidden inside active conversation/orbit thread */}
      {!isFullScreenThreadOnMobile && (
        <nav
          aria-label="Mobile navigation"
          className="flex md:hidden items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--surface)] px-1 py-1.5 pb-safe shrink-0"
        >
          {primaryDestinations.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[10px] py-1.5 text-[11px] font-medium transition-colors",
                  item.active
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="relative">
                  <Icon className="h-[18px] w-[18px]" />
                  {item.badge > 0 && (
                    <span className="absolute -right-2.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-semibold text-[var(--accent-primary-fg)]">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <WorkspaceModals />
    </div>
  );
}
