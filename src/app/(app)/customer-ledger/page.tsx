import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CustomerLedgerClient from "./CustomerLedgerClient";

export default async function CustomerLedgerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const { data: rows, error } = await supabase
    .from("customer_ledger")
    .select("*")
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">고객 관리 대장</h1>
        <p className="text-sm text-slate-500 mt-0.5">고객 문의 및 처리 내역 관리대장</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <CustomerLedgerClient rows={rows ?? []} profile={profile} />
      )}
    </div>
  );
}
