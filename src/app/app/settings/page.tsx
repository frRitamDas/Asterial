"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Download,
  Edit3,
  LogOut,
  Palette,
  Shield,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { MobileUtilityActions } from "@/components/workspace/WorkspaceShell";
import { SettingsCategoryIndexList } from "@/components/settings/SettingsNav";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { settingsService } from "@/lib/services";

export default function SettingsOverviewPage() {
  const { user, profile, preferences, signOut } = useWorkspace();
  const { pushToast } = useToast();
  const [exportingData, setExportingData] = useState(false);

  const handleExportAccountData = async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const archive = await settingsService.exportMyAccountData(
        user.id,
        user.email ?? null
      );
      const blob = new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const day = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `asterial-account-export-${day}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      pushToast({
        title: "Account export downloaded",
        description: "Saved as JSON to your device.",
        variant: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not export account data",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setExportingData(false);
    }
  };

  const themeLabel =
    preferences?.appearance_theme === "alabaster"
      ? "Daylight Light"
      : preferences?.appearance_theme === "system"
        ? "System"
        : preferences?.appearance_theme === "pitch"
          ? "OLED Pitch"
          : preferences?.appearance_theme === "graphite"
            ? "Graphite"
            : "Obsidian Dark";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Manage your profile, appearance, messaging behavior, privacy, and
              account security.
            </p>
          </div>
          <MobileUtilityActions />
        </div>

        {/* Account Summary Card */}
        <section className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar
                name={profile?.display_name || "A"}
                avatarPath={profile?.avatar_url}
                size="lg"
                online={profile?.presence_visibility !== "nobody"}
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-[var(--text-primary)]">
                  {profile?.display_name || "Your Account"}
                </h2>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {profile ? `@${profile.username}` : ""}{" "}
                  {user?.email ? `· ${user.email}` : ""}
                </p>
                {profile?.status_text && (
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    {profile.status_text}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/app/settings/profile"
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit profile</span>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                loading={exportingData}
                onClick={() => void handleExportAccountData()}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
            <Link
              href="/app/settings/appearance"
              className="flex items-center justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Palette className="h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Active theme
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {themeLabel}
                  </p>
                </div>
              </div>
              <span className="text-xs text-[var(--accent)]">Change</span>
            </Link>

            <Link
              href="/app/settings/privacy"
              className="flex items-center justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-[var(--success)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Privacy status
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {profile?.read_receipts_enabled !== false
                      ? "Read receipts on"
                      : "Read receipts hidden"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-[var(--accent)]">Manage</span>
            </Link>
          </div>
        </section>

        {/* Category Index (Primary navigation on mobile, quick directory on desktop) */}
        <section className="space-y-2.5">
          <h2 className="px-1 text-xs font-semibold text-[var(--text-secondary)]">
            All Settings Categories
          </h2>
          <SettingsCategoryIndexList />
        </section>

        {/* Sign Out Action */}
        <section className="flex items-center justify-between rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Sign out of this browser
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              You can sign back in anytime with your email and password.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </Button>
        </section>
      </div>
    </div>
  );
}
