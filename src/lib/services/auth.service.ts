"use client";

import type { Session, User } from "@supabase/supabase-js";
import { classifyAuthError } from "@asterial/core/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";
import { normalizeServiceError, ServiceError } from "./errors";

export const authService = {
  async getCurrentSession(): Promise<Session | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw normalizeServiceError(error, "Unable to restore session.");
    }
    return data.session;
  },

  async getCurrentUser(): Promise<User | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<{ user: User; session: Session }> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: params.email.trim().toLowerCase(),
        password: params.password,
      });
      if (error || !data.user || !data.session) {
        const classified = classifyAuthError(error ?? new Error("Sign-in failed"));
        throw new ServiceError(
          classified.userMessage,
          classified.category,
          classified.retryable
        );
      }
      return { user: data.user, session: data.session };
    } catch (err) {
      if (err instanceof ServiceError) throw err;
      const classified = classifyAuthError(err);
      throw new ServiceError(
        classified.userMessage,
        classified.category,
        classified.retryable
      );
    }
  },

  async signUpWithEmail(params: {
    email: string;
    password: string;
    username: string;
    displayName: string;
    emailRedirectTo: string;
  }): Promise<{ user: User | null; session: Session | null }> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { data: available, error: availErr } = await supabase.rpc(
        "check_username_available",
        { p_username: params.username.trim().toLowerCase() }
      );
      if (availErr) {
        throw normalizeServiceError(availErr, "Unable to verify username availability.");
      }
      if (!available) {
        throw new ServiceError(
          "That username is already taken. Choose another handle.",
          "validation_error",
          false
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        options: {
          emailRedirectTo: params.emailRedirectTo,
          data: {
            username: params.username.trim().toLowerCase(),
            display_name: params.displayName.trim(),
          },
        },
      });

      if (error) {
        const classified = classifyAuthError(error);
        throw new ServiceError(
          classified.userMessage,
          classified.category,
          classified.retryable
        );
      }
      return { user: data.user, session: data.session };
    } catch (err) {
      if (err instanceof ServiceError) throw err;
      const classified = classifyAuthError(err);
      throw new ServiceError(
        classified.userMessage,
        classified.category,
        classified.retryable
      );
    }
  },

  async resendVerificationEmail(
    email: string,
    emailRedirectTo: string
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo },
    });
    if (error) {
      const classified = classifyAuthError(error);
      throw new ServiceError(
        classified.userMessage,
        classified.category,
        classified.retryable
      );
    }
  },

  async requestPasswordReset(
    email: string,
    redirectTo: string
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );
    if (error) {
      const classified = classifyAuthError(error);
      throw new ServiceError(
        classified.userMessage,
        classified.category,
        classified.retryable
      );
    }
  },

  async updatePassword(newPassword: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      const classified = classifyAuthError(error);
      throw new ServiceError(
        classified.userMessage,
        classified.category,
        classified.retryable
      );
    }
  },

  async signOut(scope: "local" | "global" | "others" = "local"): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut({ scope });
    if (error) {
      throw normalizeServiceError(error, "Unable to sign out right now.");
    }
  },

  async checkUsernameAvailable(
    candidate: string,
    currentUsername?: string
  ): Promise<boolean> {
    const normalized = candidate.trim().toLowerCase();
    if (currentUsername && normalized === currentUsername.toLowerCase()) {
      return true;
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("check_username_available", {
      p_username: normalized,
    });
    if (error) {
      throw normalizeServiceError(error, "Could not verify username availability.");
    }
    return Boolean(data);
  },

  async completeOnboarding(params: {
    userId: string;
    username: string;
    displayName: string;
    bio: string;
    statusText: string;
    avatarUrl: string | null;
    presenceVisibility: Profile["presence_visibility"];
    readReceiptsEnabled: boolean;
  }): Promise<Profile> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: params.username.trim().toLowerCase(),
        display_name: params.displayName.trim(),
        bio: params.bio.trim(),
        status_text: params.statusText.trim(),
        avatar_url: params.avatarUrl,
        presence_visibility: params.presenceVisibility,
        read_receipts_enabled: params.readReceiptsEnabled,
        onboarding_completed: true,
      })
      .eq("id", params.userId)
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to complete onboarding.");
    }
    return data as Profile;
  },
};
