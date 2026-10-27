import React, { Suspense } from "react";
import { ConversationView } from "@/components/chat/ConversationView";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-zinc-500 font-mono">
          Loading conversation...
        </div>
      }
    >
      <ConversationView conversationId={id} />
    </Suspense>
  );
}
