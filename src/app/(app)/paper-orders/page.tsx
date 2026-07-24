import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PaperOrdersClient from "./PaperOrdersClient";

export default async function PaperOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("paper_orders")
    .select("*")
    .order("sort_order", { ascending: false, nullsFirst: false });

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">용지 요청</h1>
        <p className="text-sm text-slate-500 mt-0.5">용지 발송 관리대장</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <PaperOrdersClient rows={rows ?? []} />
      )}
    </div>
  );
}
