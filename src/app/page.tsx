import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
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

  const ua = (await headers()).get("user-agent") ?? "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);

  if (profile?.role === "tech" && isMobile) redirect("/installs/mine");
  redirect("/dashboard");
}
