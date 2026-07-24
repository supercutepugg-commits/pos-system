import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import BlueprintEditor from "./BlueprintEditor";
import type { Profile } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlueprintDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: blueprint }, { data: merchants }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("install_blueprints").select("*").eq("id", id).single(),
    supabase.from("merchants").select("id, business_name").order("business_name").limit(500),
  ]);

  if (!profile) redirect("/dashboard");
  if (!blueprint) notFound();

  return (
    <BlueprintEditor
      profile={profile as Profile}
      blueprint={blueprint as any}
      merchants={merchants ?? []}
    />
  );
}
