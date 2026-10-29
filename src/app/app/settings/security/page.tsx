"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authService, settingsService } from "@/lib/services";
import { passwordUpdateSchema } from "@/lib/validation/schemas";
import { formatMessageTimestamp } from "@/lib/utils/format";

export default function SettingsSecurityPage() {
  const router = useRouter();
  const { user, signOut, signOutAllDevices } = useWorkspace();
  const { pushToast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);

  const [exportingData, setExportingData] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordUpdateSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      pushToast({
        title: "Check password",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      await authService.updatePassword(parsed.data.password);
      setNewPassword("");
      setConfirmPassword("");
      pushToast({ title: "Password updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Password update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSendPasswordRecoveryEmail = async () => {
    if (!user?.email) return;
    setSendingRecovery(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password?mode=update`;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo,
      });
      if (error) {
        pushToast({
          title: "Could not send recovery email",
          description: error.message,
          variant: "error",
        });
      } else {
        pushToast({
          title: "Recovery link sent",
          description: `Check ${user.email} for the password reset link.`,
          variant: "success",
        });
      }
    } finally {
      setSendingRecovery(false);
    }
  };

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== "DELETE") return;
    setDeletingAccount(true);
    try {
      await settingsService.deleteOwnAccount();
      pushToast({
        title: "Account permanently deleted",
        variant: "success",
      });
      router.replace("/welcome");
      router.refresh();
    } catch (err) {
      setDeletingAccount(false);
      pushToast({
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Security" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Security &amp; Sessions
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Manage your password, active authentication state, data export,
              and account lifecycle.
            </p>
          </div>

          {/* Current Session Status */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Current Session
                </h3>
              </div>
              <Badge variant="accent">Active Session</Badge>
            </div>

            <div className="grid gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 text-xs sm:grid-cols-2">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Account email
                </p>
                <p className="mt-0.5 font-medium text-[var(--text-primary)] truncate">
                  {user?.email || "Authenticated session"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Last authenticated
                </p>
                <p className="mt-0.5 font-medium text-[var(--text-primary)]">
                  {user?.last_sign_in_at
                    ? formatMessageTimestamp(user.last_sign_in_at)
                    : "Current session"}
                </p>
              </div>
              <div className="sm:col-span-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)] shrink-0" />
                <span>
                  Individual per-device history is not enumerated by the client
                  SDK; use Global Sign Out below to revoke refresh tokens on
                  every signed-in browser and phone immediately.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void signOut()}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out this browser</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => void signOutAllDevices()}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out all devices</span>
              </Button>
            </div>
          </section>

          {/* Change Password & Recovery */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Password
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Update your password directly or send a recovery email link.
                </p>
              </div>
              {user?.email && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={sendingRecovery}
                  onClick={() => void handleSendPasswordRecoveryEmail()}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send recovery email</span>
                </Button>
              )}
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters, 1 letter & 1 number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftAddon={<Lock className="h-4 w-4" />}
                required
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftAddon={<Lock className="h-4 w-4" />}
                required
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={updatingPassword}
                >
                  Update password
                </Button>
              </div>
            </form>
          </section>

          {/* Data Export & Permanent Account Deletion */}
          <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Export Account Data
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Download your profile, preferences, Close Orbit, and authored
                  messages as JSON.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={exportingData}
                onClick={() => void handleExportAccountData()}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download JSON</span>
              </Button>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--danger)]/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--danger)]">
                  Delete Account Permanently
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Permanently removes your profile, memberships, Close Orbit,
                  Moments, and authentication credentials.
                </p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete account</span>
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deletingAccount) setDeleteDialogOpen(false);
        }}
        title="Permanently delete your account?"
        description="This action cannot be undone. Type DELETE below to confirm permanent account removal."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-[12px] border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Your profile, memberships, private Close Orbit, Moments, and
              authentication record will be permanently erased.
            </span>
          </div>

          <Input
            label='Type "DELETE" to confirm'
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingAccount}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletingAccount}
              disabled={deleteConfirmText.trim() !== "DELETE"}
              onClick={() => void handleDeleteAccount()}
            >
              Permanently delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
