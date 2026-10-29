import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PROTECTED_PREFIX = "/app";
const ONBOARDING_PREFIX = "/onboarding";
const AUTH_ROUTES = new Set(["/welcome", "/login", "/signup", "/forgot-password"]);

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("-auth-token") &&
        cookie.value.length > 10
    );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected =
    pathname === PROTECTED_PREFIX ||
    pathname.startsWith(`${PROTECTED_PREFIX}/`) ||
    pathname === ONBOARDING_PREFIX ||
    pathname.startsWith(`${ONBOARDING_PREFIX}/`);
  const isAuthPage = AUTH_ROUTES.has(pathname);

  if (!isProtected && !isAuthPage) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const hasCookie = hasSupabaseAuthCookie(request);

  if (isProtected && !hasCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!hasCookie) {
    return response;
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(2500),
          }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (isProtected && (error || !user)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthPage && user && !error) {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = "/app/chats";
      appUrl.search = "";
      return NextResponse.redirect(appUrl);
    }

    return response;
  } catch {
    return response;
  }
}

export const config = {
  matcher: [
    "/app/:path*",
    "/app",
    "/onboarding",
    "/onboarding/:path*",
    "/welcome",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
