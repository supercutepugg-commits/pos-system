import { NextRequest, NextResponse } from "next/server";
import { sendSignRequest, sendSignComplete } from "@/lib/solapi";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  let contractId: string | undefined;
  let type: string | undefined;
  try {
    const body = await req.json();
    let signerPhone, signerName, contractTitle, signToken;
    ({ type, signerPhone, signerName, contractTitle, signToken, contractId } = body);

    if (type === "sign_request") {
      if (!contractId) {
        return NextResponse.json({ ok: false, error: "contractId가 필요합니다." }, { status: 400 });
      }
      const { data: contract } = await createAdminClient()
        .from("contracts")
        .select("signature_zones")
        .eq("id", contractId)
        .single();
      if (!contract?.signature_zones || contract.signature_zones.length === 0) {
        return NextResponse.json(
          { ok: false, error: "서명 위치가 지정되지 않은 계약서입니다." },
          { status: 400 },
        );
      }
      await sendSignRequest({ signerPhone, signerName, contractTitle, signToken });
    } else if (type === "sign_complete") {
      await sendSignComplete({ signerPhone, signerName, contractTitle });
    } else {
      return NextResponse.json({ ok: false, error: "unknown type" }, { status: 400 });
    }

    if (contractId) {
      await createAdminClient().from("notification_logs").insert({
        entity_type: "contract",
        entity_id: contractId,
        template_key: type,
        status: "sent",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("notify error:", e);
    if (contractId) {
      await createAdminClient().from("notification_logs").insert({
        entity_type: "contract",
        entity_id: contractId,
        template_key: type,
        status: "failed",
        error: e.message,
      });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
