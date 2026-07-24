import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContractsClient from "./ContractsClient";
import type { Profile } from "@/types";

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: contracts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("contracts")
      .select("*, creator:profiles!contracts_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (!profile) redirect("/dashboard");

  return (
    <ContractsClient profile={profile as Profile} initialContracts={(contracts as any) ?? []} />
  );
}
