"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validation/schemas";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      const t = window.setTimeout(() => setUsernameStatus("idle"), 0);
      return () => window.clearTimeout(t);
    }
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
      const t = window.setTimeout(() => setUsernameStatus("invalid"), 0);
      return () => window.clearTimeout(t);
    }

    const handle = window.setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("check_username_available", {
          p_username: clean,
        });
        if (!error && typeof data === "boolean") {
          setUsernameStatus(data ? "available" : "taken");
        } else {
          setUsernameStatus("idle");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 280);

    return () => window.clearTimeout(handle);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      displayName,
      username,
      email,
      password,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    if (usernameStatus === "taken") {
      setFieldErrors({ username: "That @username is already taken." });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: available } = await supabase.rpc(
        "check_username_available",
        { p_username: parsed.data.username }
      );
      if (available === false) {
        setFieldErrors({ username: "That @username was just claimed." });
        setSubmitting(false);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            display_name: parsed.data.displayName,
            username: parsed.data.username,
          },
        },
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        setVerificationSent(true);
      }
    } catch {
      setFormError(
        "Network error while creating your account. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationSent) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Confirm your email address to continue setting up your profile."
      >
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--success)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            We sent a verification link to{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {email}
            </span>
            . Open the link to verify your email and continue onboarding.
          </p>
          <Link href="/login" className="block pt-1">
            <Button variant="secondary" className="w-full">
              Return to Sign In
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Claim your @username and continue to profile and privacy setup."
      activeTab="signup"
      footer={
        <p className="text-center text-xs text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] hover:decoration-[var(--accent)]"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-[12px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs text-[var(--danger)]"
          >
            {formError}
          </div>
        )}

        <Input
          label="Display name"
          placeholder="e.g. Aarav Sharma"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
          leftAddon={<User className="h-4 w-4" />}
          required
        />

        <Input
          label="Username"
          placeholder="aarav_sharma"
          autoComplete="username"
          value={username}
          onChange={(e) =>
            setUsername(
              e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
            )
          }
          error={fieldErrors.username}
          hint={
            usernameStatus === "available"
              ? `@${username} is available`
              : usernameStatus === "taken"
                ? `@${username} is already taken`
                : "3–24 lowercase letters, numbers, or underscores"
          }
          leftAddon={<AtSign className="h-4 w-4" />}
          rightAddon={
            usernameStatus === "checking" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : usernameStatus === "available" ? (
              <span className="text-[11px] font-medium text-[var(--success)]">
                Available
              </span>
            ) : usernameStatus === "taken" ? (
              <span className="text-[11px] font-medium text-[var(--danger)]">
                Taken
              </span>
            ) : null
          }
          required
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@domain.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          leftAddon={<Mail className="h-4 w-4" />}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters, 1 letter & 1 number"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          leftAddon={<Lock className="h-4 w-4" />}
          required
        />

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          <span>Continue to Profile Setup</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
