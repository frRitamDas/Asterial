"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Aperture,
  Compass,
  Globe,
  Layers,
  LayoutList,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  UserCircle,
  WifiOff,
  Plus,
  ChevronDown,
} from "lucide-react";
import { AsterialLogo, AsterialMark } from "@/components/brand/AsterialLogo";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ConversationSidebar } from "@/components/workspace/ConversationSidebar";
import { OnboardingModal } from "@/components/workspace/OnboardingModal";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { cn } from "@/lib/utils/cn";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

const DESKTOP_NAV_ITEMS = [
  { href: "/app/chats", matchPrefix: "/app/chats", label: "Messages", icon: MessageSquare, group: "YOUR SPACE" },
  { href: "/app/groups", matchPrefix: "/app/groups", label: "Groups", icon: Layers, group: "YOUR SPACE" },
  { href: "/app/orbits", matchPrefix: "/app/orbits", label: "Orbits", icon: Globe, group: "DISCOVER" },
  { href: "/app/moments", matchPrefix: "/app/moments", label: "Moments", icon: Aperture, group: "DISCOVER" },
  { href: "/app/feed", matchPrefix: "/app/feed", label: "Feed", icon: LayoutList, group: "DISCOVER" },
  { href: "/app/contacts", matchPrefix: "/app/contacts", label: "People", icon: Compass, group: "PERSONAL" },
  { href: "/app/profile", matchPrefix: "/app/profile", label: "Profile", icon: UserCircle, group: "PERSONAL" },
  { href: "/app/settings", matchPrefix: "/app/settings", label: "Settings", icon: Settings, group: "PERSONAL" },
] as const;

const MOBILE_NAV_ITEMS = [
  { href: "/app/chats", matchPrefix: "/app/chats", label: "Chats", icon: MessageSquare },
  { href: "/app/orbits", matchPrefix: "/app/orbits", label: "Orbits", icon: Globe },
  { href: "/app/moments", matchPrefix: "/app/moments", label: "Moments", icon: Aperture },
  { href: "/app/feed", matchPrefix: "/app/feed", label: "Feed", icon: LayoutList },
  { href: "/app/contacts", matchPrefix: "/app/contacts", label: "People", icon: Compass },
] as const;

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, totalUnreadCount, isNetworkOnline, setActiveModal, signOut } = useWorkspace();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setActiveModal("search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActiveModal]);

  const isChatsSection = pathname.startsWith("/app/chats");
  const isActiveChatThread = pathname.startsWith("/app/chats/") && pathname !== "/app/chats";
  const isActiveOrbitThread = pathname.startsWith("/app/orbits/") && pathname !== "/app/orbits";

  return (
    <div className="asterial-workspace flex h-dvh w-full flex-col overflow-hidden bg-[#08090d] text-white">
      {!isNetworkOnline && (
        <div role="status" className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-200/10 bg-amber-300/[0.07] px-4 py-2 text-xs text-amber-100/80">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Connection interrupted — reconnecting and syncing your space.</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[232px] shrink-0 flex-col border-r border-white/[0.07] bg-[#090a0f] px-3 pb-3 pt-5 md:flex">
          <Link href="/app/chats" className="mb-7 flex items-center px-3" aria-label="ASTERIAL workspace">
            <AsterialLogo size="md" />
          </Link>

          <button type="button" onClick={() => setActiveModal("search")} aria-label="Search workspace" className="group mb-7 flex h-10 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-zinc-400 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white">
            <Search className="h-4 w-4 text-zinc-500 transition group-hover:text-sky-200" />
            <span className="flex-1 text-left text-xs">Search workspace</span>
            <kbd className="rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">⌘ K</kbd>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto px-1">
            {(["YOUR SPACE", "DISCOVER", "PERSONAL"] as const).map((group) => (
              <div key={group} className="mb-6">
                <p className="mb-2 px-3 text-[9px] font-semibold tracking-[0.2em] text-zinc-600">{group}</p>
                <nav aria-label={group} className="space-y-1">
                  {DESKTOP_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.matchPrefix);
                    const showBadge = item.href === "/app/chats" && totalUnreadCount > 0;
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                        className={cn("group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition duration-200",
                          active ? "bg-white text-[#0a0b0f] shadow-[0_5px_20px_rgba(255,255,255,0.06)]" : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100")}>
                        <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-[#0a0b0f]" : "text-zinc-500 group-hover:text-sky-200")} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold", active ? "bg-[#0a0b0f] text-white" : "bg-sky-200 text-[#071018]")}>{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</span>}
                        {active && <span className="absolute left-0 top-2 h-6 w-[2px] rounded-full bg-sky-300" />}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setActiveModal("new-dm")} className="mb-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-200 to-indigo-200 text-xs font-bold text-[#0a0b10] shadow-[0_8px_24px_rgba(125,185,255,0.12)] transition hover:brightness-105">
            <Plus className="h-4 w-4" /> New conversation
          </button>

          <div className="border-t border-white/[0.07] pt-3">
            {profile ? (
              <div className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
                <Link href="/app/profile" className="shrink-0">
                  <Avatar name={profile.display_name} avatarPath={profile.avatar_url} size="md" online={isNetworkOnline && profile.presence_visibility !== "nobody"} showPresence />
                </Link>
                <Link href="/app/profile" className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-100">{profile.display_name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500">@{profile.username}</p>
                </Link>
                <button type="button" onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.07] hover:text-white"><LogOut className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2"><AsterialMark size={28} /><span className="text-xs text-zinc-500">Your space</span></div>
            )}
            <p className="mt-2 px-3 text-[9px] text-zinc-700">{ASTERIAL_BRAND.name} · v{ASTERIAL_BRAND.version}</p>
          </div>
        </aside>

        {isChatsSection && (
          <ConversationSidebar className={cn("w-full shrink-0 border-r border-white/[0.07] md:w-[300px] lg:w-[340px]", isActiveChatThread ? "hidden md:flex" : "flex")} />
        )}

        <main className={cn("asterial-workspace-main flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0b0c11]", pathname === "/app/chats" ? "hidden md:flex" : "flex")}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {!isActiveChatThread && !isActiveOrbitThread && (
        <nav aria-label="Mobile navigation" className="asterial-mobile-nav flex shrink-0 items-center justify-around border-t border-white/[0.08] bg-[#090a0f]/95 px-1 pt-1.5 pb-1.5 pb-safe backdrop-blur-2xl md:hidden">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.matchPrefix);
            const showBadge = item.href === "/app/chats" && totalUnreadCount > 0;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex min-h-[48px] min-w-[50px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-[9px] font-medium transition",
                  active ? "text-white" : "text-zinc-600 hover:text-zinc-300")}>
                <span className={cn("flex h-7 w-9 items-center justify-center rounded-xl transition", active ? "bg-white/[0.09] text-sky-200" : "")}><Icon className="h-[17px] w-[17px]" /></span>
                <span>{item.label}</span>
                {showBadge && <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-200 px-1 font-mono text-[9px] font-bold text-[#071018]">{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</span>}
              </Link>
            );
          })}
          <Link href="/app/settings" aria-current={pathname.startsWith("/app/settings") ? "page" : undefined} className={cn("flex min-h-[48px] min-w-[50px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-[9px] font-medium", pathname.startsWith("/app/settings") ? "text-white" : "text-zinc-600")}>
            <span className="flex h-7 w-9 items-center justify-center rounded-xl"><Settings className="h-[17px] w-[17px]" /></span><span>Settings</span>
          </Link>
        </nav>
      )}

      <OnboardingModal />
      <WorkspaceModals />
    </div>
  );
}
