"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema, sanitizeRedirectPath } from "@/lib/validation/schemas";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeRedirectPath(
    searchParams.get("next"),
    "/app/chats"
  );
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(callbackError);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "password";
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error || !data.user) {
        setFormError(
          error?.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : error?.message || "Unable to sign in right now."
        );
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileRow && profileRow.onboarding_completed === false) {
        router.replace("/onboarding");
      } else {
        router.replace(nextPath);
      }
      router.refresh();
    } catch {
      setFormError(
        "Network error while reaching authentication. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your email and password to open your conversations."
      activeTab="login"
      footer={
        <p className="text-center text-xs text-[var(--text-secondary)]">
          New to ASTERIAL?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] hover:decoration-[var(--accent)]"
          >
            Create an account
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
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          leftAddon={<Mail className="h-4 w-4" />}
          required
        />

        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            leftAddon={<Lock className="h-4 w-4" />}
            required
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          <span>Sign In</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[var(--background)] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Loading authentication…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
