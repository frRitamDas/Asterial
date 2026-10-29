"use client";

import React from "react";
import { Ban, Check } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { settingsService } from "@/lib/services";
import { cn } from "@/lib/utils/cn";
import type {
  AllowDirectMessages,
  GroupInvitePermission,
  MomentsDefaultAudience,
  PresenceVisibility,
} from "@/lib/types/database";

export default function SettingsPrivacyPage() {
  const { user, profile, blockedProfiles, refreshProfile, unblockUser } =
    useWorkspace();
  const { pushToast } = useToast();

  const updatePrivacy = async (
    patch: Parameters<typeof settingsService.updatePrivacy>[1]
  ) => {
    if (!user) return;
    try {
      await settingsService.updatePrivacy(user.id, patch);
      await refreshProfile();
      pushToast({ title: "Privacy updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not update privacy setting",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const presenceVisibility: PresenceVisibility =
    profile?.presence_visibility || "everyone";
  const showReadReceipts = profile?.read_receipts_enabled !== false;
  const discoverable = profile?.discoverable_by_search !== false;
  const allowDms: AllowDirectMessages =
    profile?.allow_direct_messages || "everyone";
  const groupInvites: GroupInvitePermission =
    profile?.group_invite_permission || "everyone";
  const momentsAudience: MomentsDefaultAudience =
    profile?.moments_default_audience || "everyone";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Privacy" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Privacy &amp; Safety
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Account-level privacy controls enforced across clients and
              PostgreSQL policies.
            </p>
          </div>

          {/* Online & Last Seen Visibility */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Online &amp; Last Seen Visibility
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Choose who can see your active presence dot and last-seen
                timestamp.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["everyone", "Everyone", "Visible across directory & chats"],
                  ["contacts", "Contacts", "People in your conversations"],
                  ["nobody", "Nobody", "Hide online & last seen everywhere"],
                ] as const
              ).map(([val, label, sub]) => {
                const active = presenceVisibility === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      void updatePrivacy({ presence_visibility: val })
                    }
                    className={cn(
                      "flex flex-col justify-between gap-1 rounded-[12px] border p-3 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {label}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Read Receipts & Search Discoverability */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <Switch
              id="privacy-read-receipts"
              checked={showReadReceipts}
              onCheckedChange={(next) =>
                void updatePrivacy({ read_receipts_enabled: next })
              }
              label="Read receipts"
              description="Share when you have read messages. Turning this off reciprocally hides others' read receipts."
            />

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="privacy-discoverable"
                checked={discoverable}
                onCheckedChange={(next) =>
                  void updatePrivacy({ discoverable_by_search: next })
                }
                label="Discoverable by @username search"
                description="Allow people outside your existing chats to find your profile in People directory search."
              />
            </div>
          </section>

          {/* Direct Messages Permission */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Direct Message Requests
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Control who can open a new 1:1 direct conversation with you.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["everyone", "Everyone", "Any signed-in ASTERIAL member"],
                  [
                    "none",
                    "Existing threads only",
                    "Prevent new unsolicited direct threads",
                  ],
                ] as const
              ).map(([val, title, desc]) => {
                const active = allowDms === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      void updatePrivacy({ allow_direct_messages: val })
                    }
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-[12px] border p-3.5 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {desc}
                      </p>
                    </div>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Who Can Add Me to Groups */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Who Can Add Me to Groups
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Enforced directly by group creation and member-invite database
                functions.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["everyone", "Everyone", "Any member can invite you"],
                  ["contacts", "Contacts", "People you chat with or Orbit"],
                  ["nobody", "Nobody", "Block all new group additions"],
                ] as const
              ).map(([val, title, desc]) => {
                const active = groupInvites === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      void updatePrivacy({ group_invite_permission: val })
                    }
                    className={cn(
                      "flex flex-col items-start rounded-[12px] border p-3 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {title}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      )}
                    </div>
                    <span className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Default Moments Audience */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Default Moments Audience
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Pre-selected audience whenever you compose a new Moment.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["everyone", "Everyone", "All signed-in members"],
                  ["contacts", "Contacts", "Direct message contacts"],
                  ["orbit", "Close Orbit", "Only your Close Orbit"],
                ] as const
              ).map(([val, title, desc]) => {
                const active = momentsAudience === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      void updatePrivacy({ moments_default_audience: val })
                    }
                    className={cn(
                      "flex flex-col items-start rounded-[12px] border p-3 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {title}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      )}
                    </div>
                    <span className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Blocked Users Management */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Blocked Accounts ({blockedProfiles.length})
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Blocked accounts cannot message you, add you to groups, or view
                your Moments.
              </p>
            </div>

            {blockedProfiles.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 text-xs text-[var(--text-muted)]">
                <Ban className="h-4 w-4 shrink-0" />
                <span>You have not blocked any accounts.</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                {blockedProfiles.map((bp) => (
                  <div
                    key={bp.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={bp.display_name}
                        avatarPath={bp.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {bp.display_name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-secondary)]">
                          @{bp.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void unblockUser(bp.id)}
                    >
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
