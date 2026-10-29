"use client";

import React from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { ACCENT_PRESETS, THEME_PALETTES } from "@asterial/core";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils/cn";
import type {
  AccentColor,
  AppearanceTheme,
  MessageDensity,
} from "@/lib/types/database";

const THEME_ORDER: AppearanceTheme[] = [
  "obsidian",
  "alabaster",
  "system",
  "pitch",
  "graphite",
];

export default function SettingsAppearancePage() {
  const { preferences, updatePreferences } = useWorkspace();

  const currentTheme: AppearanceTheme =
    preferences?.appearance_theme || "obsidian";
  const currentAccent: AccentColor = preferences?.accent_color || "indigo";
  const currentDensity: MessageDensity =
    preferences?.message_density || "comfortable";
  const reducedMotion = Boolean(preferences?.reduced_motion);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Appearance" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Appearance
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Changes apply across the entire application immediately and sync
              to your account.
            </p>
          </div>

          {/* Theme Palette Selection */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Color Theme
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Choose a near-black dark mode, crisp daylight surface, or follow
                your operating system.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {THEME_ORDER.map((id) => {
                const palette = THEME_PALETTES[id];
                const active = currentTheme === id;
                const Icon =
                  id === "alabaster" ? Sun : id === "system" ? Monitor : Moon;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      void updatePreferences({ appearance_theme: id })
                    }
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-[14px] border p-3.5 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border"
                        style={{
                          backgroundColor: palette.bgCanvas,
                          borderColor: palette.borderStrong,
                          color: palette.textPrimary,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {palette.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] leading-snug">
                          {palette.description}
                        </p>
                      </div>
                    </div>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)] mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Accent Color */}
          <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Accent Color
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Applied selectively to active tabs, unread counters, focus
                rings, and primary buttons.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Object.values(ACCENT_PRESETS).map((preset) => {
                const active = currentAccent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      void updatePreferences({ accent_color: preset.id })
                    }
                    className={cn(
                      "flex items-center justify-between gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors cursor-pointer",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-signal-subtle)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/20"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {preset.label}
                      </span>
                    </div>
                    {active && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Density & Motion */}
          <section className="space-y-5 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Message &amp; List Density
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Adjust spacing inside conversation rows and message bubbles.
                </p>
              </div>
              <SegmentedControl<MessageDensity>
                ariaLabel="Message density"
                value={currentDensity}
                onChange={(next) =>
                  void updatePreferences({ message_density: next })
                }
                options={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Switch
                id="appearance-reduced-motion"
                checked={reducedMotion}
                onCheckedChange={(next) =>
                  void updatePreferences({ reduced_motion: next })
                }
                label="Reduce motion"
                description="Minimize panel transitions and micro-animations across the interface."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
