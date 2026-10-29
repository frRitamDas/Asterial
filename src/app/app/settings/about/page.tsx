"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, Shield, Smartphone } from "lucide-react";
import { ASTERIAL_BRAND } from "@asterial/core";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";

export default function SettingsAboutPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="About" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              About ASTERIAL
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Official release metadata, developer attribution, security
              architecture, and legal policies.
            </p>
          </div>

          <section className="space-y-5 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <AsterialLogo showVersion showAttribution size="md" />

              <Link
                href="/download"
                className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-3.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Android APK</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-2.5 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3 text-xs">
              <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Version</p>
                <p className="mt-0.5 font-mono font-semibold text-[var(--text-primary)]">
                  v{ASTERIAL_BRAND.version} ({ASTERIAL_BRAND.versionCode})
                </p>
              </div>

              <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Developer</p>
                <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                  {ASTERIAL_BRAND.developer}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {ASTERIAL_BRAND.attribution}
                </p>
              </div>

              <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Android Package
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--text-primary)] break-all">
                  {ASTERIAL_BRAND.androidPackageId}
                </p>
              </div>
            </div>

            {/* Release Notes */}
            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                What’s in v{ASTERIAL_BRAND.version}
              </h3>
              <ul className="space-y-1.5 pl-4 text-xs text-[var(--text-secondary)] list-disc">
                {ASTERIAL_BRAND.releaseNotes.map((note, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* Honest Security Notice */}
            <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Shield className="h-3.5 w-3.5 text-[var(--success)]" />
                <span>Data Protection &amp; Transport Security</span>
              </div>
              <p>{ASTERIAL_BRAND.securityNotice}</p>
            </div>

            {/* Legal & Release Links */}
            <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border-subtle)] pt-4 text-xs">
              <Link
                href="/privacy"
                className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline decoration-[var(--border-strong)]"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline decoration-[var(--border-strong)]"
              >
                Terms of Service
              </Link>
              <Link
                href="/download"
                className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline decoration-[var(--border-strong)]"
              >
                Release Downloads
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
