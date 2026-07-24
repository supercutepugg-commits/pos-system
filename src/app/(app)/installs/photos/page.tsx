import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PhotosClient from "./PhotosClient";
import type { Profile } from "@/types";

export default async function InstallPhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/dashboard");

  const { data: installs } = await supabase
    .from("installations")
    .select(
      "id, customer_name, delivery_type, completion_photo_urls, notes, created_at, assignee:profiles!installations_assigned_to_fkey(name)",
    )
    .eq("status", "completed")
    .not("completion_photo_urls", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const withPhotos = (installs ?? []).filter((i) => (i.completion_photo_urls?.length ?? 0) > 0);

  return <PhotosClient profile={profile as Profile} installs={withPhotos as any} />;
}
