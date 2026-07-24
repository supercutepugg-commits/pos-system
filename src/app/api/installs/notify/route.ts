import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendApprovedInstallNotification } from "@/lib/installNotifications";

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["tech", "admin", "master"].includes(profile.role)) {
      return NextResponse.json({ ok: false, error: "발송 권한이 없습니다." }, { status: 403 });
    }

    const body = await req.json();
    const { installationId, status, eta } = body;
    if (typeof installationId !== "string" || typeof status !== "string") {
      return NextResponse.json({ ok: false, error: "missing params" }, { status: 400 });
    }
    const result = await sendApprovedInstallNotification({
      installationId,
      status,
      eta,
      userId: user.id,
    });
    return result.error
      ? NextResponse.json({ ok: false, error: result.error }, { status: 500 })
      : NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("install notify error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "알림톡 발송에 실패했습니다." },
      { status: 500 },
    );
  }
}
