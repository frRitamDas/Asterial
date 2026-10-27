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
  const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/app/chats");
  const initialError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" && !nextErrors.email) nextErrors.email = issue.message;
        if (key === "password" && !nextErrors.password)
          nextErrors.password = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login")) {
          setFormError("Invalid email address or password.");
        } else {
          setFormError(error.message);
        }
        setLoading(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setFormError(
        "Unable to connect to ASTERIAL authentication. Check your network and try again."
      );
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to ASTERIAL"
      subtitle="Enter your credentials to resume your conversations."
      footer={
        <p className="text-center text-xs text-zinc-400">
          New to ASTERIAL?{" "}
          <Link
            href="/signup"
            className="font-medium text-white underline underline-offset-4 hover:text-zinc-200"
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
            className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
          >
            {formError}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          leftAddon={<Mail className="h-4 w-4" />}
          required
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-xs font-medium tracking-wide text-zinc-300"
            >
              Password
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            leftAddon={<Lock className="h-4 w-4" />}
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Sign in
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
        <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-void)] text-xs text-zinc-500 font-mono">
          Initializing ASTERIAL...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
