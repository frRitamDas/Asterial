"use client";

import React from "react";
import { Compass, MessageSquarePlus, Search, Users } from "lucide-react";
import Link from "next/link";
import { AsterialMark } from "@/components/brand/AsterialLogo";
import { ConstellationBackdrop } from "@/components/brand/ConstellationBackdrop";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export default function ChatsEmptyWorkspacePage() {
  const { setActiveModal } = useWorkspace();

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-8 text-center">
      <ConstellationBackdrop />
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <AsterialMark size={52} />

        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
          {ASTERIAL_BRAND.emptyStateTitle}
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {ASTERIAL_BRAND.emptyStateBody}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={() => setActiveModal("new-dm")}
          >
            <MessageSquarePlus className="h-4 w-4" />
            New conversation
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setActiveModal("new-group")}
          >
            <Users className="h-4 w-4" />
            Create group
          </Button>
        </div>

        <div className="mt-8 flex items-center gap-5 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => setActiveModal("search")}
            className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            Search workspace (⌘K)
          </button>
          <span className="text-zinc-700">·</span>
          <Link
            href="/app/contacts"
            className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
          >
            <Compass className="h-3.5 w-3.5" />
            Explore contacts
          </Link>
        </div>
      </div>
    </div>
  );
}
