import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg-void)] text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] bg-[var(--bg-void)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/">
            <AsterialLogo size="sm" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14 space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version} ·{" "}
            {ASTERIAL_BRAND.attribution}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            Effective Date: October 27, 2026 · Official Developer:{" "}
            {ASTERIAL_BRAND.developer}
          </p>
        </div>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            1. Acceptable Use
          </h2>
          <p>
            By registering for {ASTERIAL_BRAND.name}, you agree not to use the
            platform for harassment, spam, impersonation, distribution of
            malicious files, unauthorized access attempts, or unlawful content.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            2. Accounts &amp; Handles
          </h2>
          <p>
            You are responsible for safeguarding your account credentials.
            Usernames are assigned on a unique basis and must not impersonate
            other individuals or organizations.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            3. Moderation, Blocking &amp; Reporting
          </h2>
          <p>
            Users may block accounts and submit abuse reports directly within
            the application. Accounts violating these terms may be restricted or
            removed to protect platform integrity.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            4. Attribution &amp; Intellectual Property
          </h2>
          <p>
            {ASTERIAL_BRAND.name} (Version {ASTERIAL_BRAND.version}) is
            developed by {ASTERIAL_BRAND.developer} ({ASTERIAL_BRAND.attribution}
            ). You retain ownership of the content you transmit through your
            conversations.
          </p>
        </section>
      </main>
    </div>
  );
}
