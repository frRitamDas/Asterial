import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg-void)] text-[var(--text-primary)]">
      <header className="border-b border-white/[0.08] bg-[var(--bg-void)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/">
            <AsterialLogo showVersion size="sm" />
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            Effective Date: October 27, 2026 · Official Developer:{" "}
            {ASTERIAL_BRAND.developer}
          </p>
        </div>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            1. Information We Store
          </h2>
          <p>
            {ASTERIAL_BRAND.name} collects only the information necessary to
            operate your messaging account: your authentication email address
            (stored securely in Supabase Auth and never exposed in public user
            search), your chosen username, display name, optional bio, status
            message, profile image, conversation memberships, messages, and
            uploaded attachments.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            2. Access Control &amp; Security Architecture
          </h2>
          <p>{ASTERIAL_BRAND.securityNotice}</p>
          <p>
            Uploaded images and files are stored in private buckets and served
            exclusively via time-limited signed URLs after verifying active
            conversation membership.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            3. Presence, Read Receipts &amp; Blocking Controls
          </h2>
          <p>
            In Settings &rarr; Privacy, you control whether your online status
            and last-seen timestamps are visible to Everyone, Contacts Only, or
            Nobody. You may also disable outgoing read receipts and block
            specific accounts from initiating direct conversations or messaging
            you directly.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white">
            4. Data Deletion
          </h2>
          <p>
            You can delete individual messages you sent (which clears their
            message body and deletes associated attachment files) or permanently
            delete your entire {ASTERIAL_BRAND.name} account from Settings
            &rarr; Data &amp; Account Management.
          </p>
        </section>
      </main>
    </div>
  );
}
