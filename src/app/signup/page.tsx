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
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signupSchema, usernameSchema } from "@/lib/validation/schemas";

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkedHandle, setCheckedHandle] = useState<{
    handle: string;
    state: "available" | "taken" | "idle";
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const trimmedUsername = username.trim().toLowerCase();
  const isUsernameFormatValid =
    trimmedUsername.length > 0 &&
    usernameSchema.safeParse(trimmedUsername).success;

  // Debounced live username uniqueness check
  useEffect(() => {
    if (!isUsernameFormatValid) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("check_username_available", {
          p_username: trimmedUsername,
        });
        if (!active) return;
        if (error) {
          setCheckedHandle({ handle: trimmedUsername, state: "idle" });
          return;
        }
        setCheckedHandle({
          handle: trimmedUsername,
          state: data ? "available" : "taken",
        });
      } catch {
        if (active) {
          setCheckedHandle({ handle: trimmedUsername, state: "idle" });
        }
      }
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isUsernameFormatValid, trimmedUsername]);

  const usernameState: "idle" | "checking" | "available" | "taken" | "invalid" =
    !trimmedUsername
      ? "idle"
      : !isUsernameFormatValid
        ? "invalid"
        : checkedHandle?.handle !== trimmedUsername
          ? "checking"
          : checkedHandle.state;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      username,
      displayName,
      email,
      password,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || "");
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    if (usernameState === "taken") {
      setFieldErrors({ username: "That username is already claimed." });
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Double-check availability server-side right before registration
      const { data: available } = await supabase.rpc(
        "check_username_available",
        { p_username: parsed.data.username }
      );
      if (available === false) {
        setFieldErrors({ username: "That username was just claimed. Pick another." });
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth/callback?next=/app/chats`;
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: parsed.data.username,
            display_name: parsed.data.displayName,
          },
        },
      });

      if (error) {
        setFormError(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Ensure profile matches exact chosen username & mark onboarding complete
        await supabase.rpc("complete_profile_onboarding", {
          p_username: parsed.data.username,
          p_display_name: parsed.data.displayName,
          p_bio: "",
          p_status_text: "",
        });
        router.replace("/app/chats");
        router.refresh();
        return;
      }

      // Email verification required by Supabase project settings
      setVerificationSentTo(parsed.data.email);
      setLoading(false);
    } catch {
      setFormError(
        "Network error while creating your account. Please try again."
      );
      setLoading(false);
    }
  };

  if (verificationSentTo) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="One final step to activate your ASTERIAL identity."
      >
        <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-6 space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="font-mono text-white">{verificationSentTo}</span>.
            Open the link to complete verification and enter your workspace.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your ASTERIAL account"
      subtitle="Claim your unique handle and start connecting."
      footer={
        <p className="text-center text-xs text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-white underline underline-offset-4 hover:text-zinc-200"
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
            className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
          >
            {formError}
          </div>
        )}

        <Input
          label="Username"
          name="username"
          autoComplete="username"
          placeholder="ritam_das"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
          maxLength={24}
          leftAddon={<AtSign className="h-4 w-4" />}
          rightAddon={
            usernameState === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : usernameState === "available" ? (
              <CheckCircle2
                className="h-4 w-4 text-emerald-400"
                aria-label="Username available"
              />
            ) : usernameState === "taken" ? (
              <XCircle
                className="h-4 w-4 text-red-400"
                aria-label="Username taken"
              />
            ) : null
          }
          hint={
            usernameState === "available"
              ? `@${username} is available`
              : "3–24 lowercase letters, numbers, or underscores"
          }
          error={
            fieldErrors.username ||
            (usernameState === "taken"
              ? "That username is already taken."
              : undefined)
          }
          required
        />

        <Input
          label="Display name"
          name="displayName"
          autoComplete="name"
          placeholder="Ritam Das"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          leftAddon={<UserIcon className="h-4 w-4" />}
          error={fieldErrors.displayName}
          required
        />

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftAddon={<Mail className="h-4 w-4" />}
          error={fieldErrors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftAddon={<Lock className="h-4 w-4" />}
          hint="Use at least 8 characters."
          error={fieldErrors.password}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Create account
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          By creating an account, you agree to the{" "}
          <Link href="/terms" className="text-zinc-300 underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-zinc-300 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
