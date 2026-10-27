import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      confirmation?: string;
    } | null;

    if (body?.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm permanent account removal." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized session." },
        { status: 401 }
      );
    }

    // Remove user's private storage objects via Storage API prior to DB account deletion
    const [{ data: prof }, { data: attRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("attachments")
        .select("storage_path")
        .eq("uploader_id", user.id)
        .limit(500),
    ]);

    if (prof?.avatar_url) {
      await supabase.storage
        .from("avatars")
        .remove([prof.avatar_url])
        .catch(() => {});
    }
    const attachmentPaths = ((attRows || []) as Array<{ storage_path: string }>).map(
      (a) => a.storage_path
    );
    if (attachmentPaths.length > 0) {
      await supabase.storage
        .from("chat-attachments")
        .remove(attachmentPaths)
        .catch(() => {});
    }

    // Execute database cleanup + ownership transfer first via authenticated RPC
    const { error: rpcErr } = await supabase.rpc("delete_own_account");
    if (!rpcErr) {
      return NextResponse.json({ ok: true });
    }

    // Fallback to service-role admin API if configured
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: rpcErr.message || "Unable to complete account deletion." },
        { status: 500 }
      );
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return NextResponse.json(
        { error: "Account deletion failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Server could not reach authentication backend." },
      { status: 503 }
    );
  }
}
