"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetRequestSchema } from "@/lib/validation/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address linked to your account to receive a recovery link."
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
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--success)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Check your inbox
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            If an account exists for{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {email}
            </span>
            , a password recovery link has been sent.
          </p>
        </div>
      ) : (
        <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-[12px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs text-[var(--danger)]"
            >
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
