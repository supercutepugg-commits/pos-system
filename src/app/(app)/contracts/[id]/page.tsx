import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ZoneEditor from "./ZoneEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContractZonePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["master", "admin", "cs"].includes(profile.role)) redirect("/dashboard");

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, pdf_url, signer_name, signer_phone, status, sign_token, signature_zones")
    .eq("id", id)
    .single();

  if (!contract) notFound();

  return (
    <ZoneEditor
      contract={{
        ...contract,
        signature_zones: contract.signature_zones ?? [],
      }}
    />
  );
}
