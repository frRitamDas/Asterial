import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeRedirectPath(
    searchParams.get("next"),
    type === "recovery" ? "/reset-password?mode=update" : "/app/chats"
  );

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  } catch {
    // Fall through to login error redirect
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Verification link expired or invalid. Please sign in or request a new link."
    )}`
  );
}
