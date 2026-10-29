"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  passwordUpdateSchema,
  resetRequestSchema,
} from "@/lib/validation/schemas";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "update" ? "update" : "request";

  const [mode, setMode] = useState<"request" | "update">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password?mode=update`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        { redirectTo }
      );
      if (resetErr) {
        setError(resetErr.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error while requesting password reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = passwordUpdateSchema.safeParse({
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateErr) {
        setError(updateErr.message);
      } else {
        setUpdated(true);
        window.setTimeout(() => {
          router.replace("/app/chats");
        }, 1200);
      }
    } catch {
      setError("Network error while updating your password.");
    } finally {
      setLoading(false);
    }
  };

  if (updated) {
    return (
      <AuthShell
        title="Password updated"
        subtitle="Your account credentials have been updated."
        stepLabel="Account Recovery"
      >
        <div className="space-y-3 py-1">
          <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Your new password is active. Redirecting to your workspace…
          </p>
        </div>
      </AuthShell>
    );
  }

  if (mode === "update") {
    return (
      <AuthShell
        title="Choose a new password"
        subtitle="Enter a strong new password for your ASTERIAL account."
        stepLabel="Account Recovery"
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-[12px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs text-[var(--danger)]">
              {error}
            </div>
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftAddon={<Lock className="h-4 w-4" />}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftAddon={<Lock className="h-4 w-4" />}
            required
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Save New Password
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email address to receive a password recovery link."
      stepLabel="Account Recovery"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign In</span>
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-3 py-1">
          <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            If an account exists for{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {email}
            </span>
            , a recovery link has been sent.
          </p>
        </div>
      ) : (
        <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-[12px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs text-[var(--danger)]">
              {error}
            </div>
          )}
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftAddon={<Mail className="h-4 w-4" />}
            required
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Send Recovery Link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[var(--background)] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
