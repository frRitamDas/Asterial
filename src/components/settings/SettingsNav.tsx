"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  HardDrive,
  Info,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Palette,
  Shield,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SettingsCategoryItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategoryItem[] = [
  {
    href: "/app/settings",
    label: "Account Overview",
    description: "Summary, quick links, and data export",
    icon: LayoutGrid,
    exact: true,
  },
  {
    href: "/app/settings/profile",
    label: "Profile",
    description: "Avatar, display name, @username, bio, status",
    icon: UserRound,
  },
  {
    href: "/app/settings/appearance",
    label: "Appearance",
    description: "Dark, Light, System theme, accent, density",
    icon: Palette,
  },
  {
    href: "/app/settings/chat",
    label: "Chat",
    description: "Enter to send, previews, wallpaper, auto-download",
    icon: MessageSquare,
  },
  {
    href: "/app/settings/notifications",
    label: "Notifications",
    description: "Browser permission, DM/group alerts, sound, mutes",
    icon: Bell,
  },
  {
    href: "/app/settings/privacy",
    label: "Privacy",
    description: "Presence, read receipts, Moments, blocks, invites",
    icon: Shield,
  },
  {
    href: "/app/settings/security",
    label: "Security",
    description: "Password, session status, sign out, delete account",
    icon: KeyRound,
  },
  {
    href: "/app/settings/storage",
    label: "Storage & Media",
    description: "Uploaded media summary and local cache controls",
    icon: HardDrive,
  },
  {
    href: "/app/settings/about",
    label: "About",
    description: "Release version, developer, legal, and Android app",
    icon: Info,
  },
];

export function SettingsSidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Settings categories"
      className="hidden md:flex w-[248px] lg:w-[268px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)]"
    >
      <div className="flex h-14 items-center border-b border-[var(--border-subtle)] px-5 shrink-0">
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {SETTINGS_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = cat.exact
            ? pathname === cat.href
            : pathname === cat.href || pathname.startsWith(`${cat.href}/`);

          return (
            <Link
              key={cat.href}
              href={cat.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-xs transition-colors",
                active
                  ? "bg-[var(--accent-signal-subtle)] text-[var(--text-primary)] font-semibold border border-[var(--border-active)]"
                  : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                )}
              />
              <span className="truncate">{cat.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function SettingsMobileSubpageHeader({ title }: { title: string }) {
  return (
    <div className="flex md:hidden h-13 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-3 shrink-0">
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Settings</span>
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
        {title}
      </span>
    </div>
  );
}

export function SettingsCategoryIndexList() {
  return (
    <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)]">
      {SETTINGS_CATEGORIES.filter((c) => !c.exact).map((cat) => {
        const Icon = cat.icon;
        return (
          <Link
            key={cat.href}
            href={cat.href}
            className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--accent)]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {cat.label}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {cat.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          </Link>
        );
      })}
    </div>
  );
}
