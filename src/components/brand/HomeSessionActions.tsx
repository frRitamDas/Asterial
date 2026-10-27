"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function HomeSessionActions({ compact = false }: { compact?: boolean }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data }) => {
        if (mounted && data.session) {
          setSignedIn(true);
        }
      });
    } catch {
      // Ignore client init errors on static views
    }
    return () => {
      mounted = false;
    };
  }, []);

  if (compact) {
    return signedIn ? (
      <Link
        href="/app/chats"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
      >
        Open Workspace
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    ) : (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-xl px-3.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
        >
          Get started
        </Link>
      </div>
    );
  }

  return signedIn ? (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/app/chats"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
      >
        Enter ASTERIAL Workspace
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href="/app/settings"
        className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-medium text-zinc-200 hover:bg-white/[0.07] transition-colors"
      >
        Account Settings
      </Link>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/signup"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
      >
        Create your account
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href="/login"
        className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-medium text-zinc-200 hover:bg-white/[0.07] transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}
