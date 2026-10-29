import React from "react";
import { SettingsSidebarNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--background)]">
      <SettingsSidebarNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
