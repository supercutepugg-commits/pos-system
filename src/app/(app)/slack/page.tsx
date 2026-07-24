import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchSlackMessages } from "@/lib/slack";
import SlackMessagesClient from "./SlackMessagesClient";

const SLACK_CHANNEL_ID = "C06KTK05F0B";

export default async function SlackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let messages: Awaited<ReturnType<typeof fetchSlackMessages>> = [];
  let error: string | null = null;
  try {
    messages = await fetchSlackMessages(SLACK_CHANNEL_ID);
  } catch (err: any) {
    error = err.message;
  }

  return <SlackMessagesClient initialMessages={messages} initialError={error} />;
}
