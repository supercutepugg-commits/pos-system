import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DevRequestsClient from "./DevRequestsClient";

export default async function DevRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const { data: rows, error } = await supabase
    .from("dev_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">개발요청</h1>
        <p className="text-sm text-slate-500 mt-0.5">개발 요청 관리대장</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <DevRequestsClient rows={rows ?? []} profile={profile} />
      )}
    </div>
  );
}
