export interface SlackMessage {
  ts: string;
  user: string;
  text: string;
}

const userNameCache = new Map<string, string>();

async function resolveUserName(token: string, userId: string): Promise<string> {
  const cached = userNameCache.get(userId);
  if (cached) return cached;

  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  const name = data.ok
    ? data.user?.profile?.display_name || data.user?.profile?.real_name || data.user?.name || userId
    : userId;
  userNameCache.set(userId, name);
  return name;
}

export async function fetchSlackMessages(channel: string, limit = 50): Promise<SlackMessage[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN이 설정되지 않았습니다");

  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API 오류: ${data.error}`);

  const rawMessages = (data.messages ?? []) as any[];
  const userIds = [...new Set(rawMessages.map((m) => m.user).filter(Boolean))] as string[];
  const nameEntries = await Promise.all(
    userIds.map(async (id) => [id, await resolveUserName(token, id)] as const),
  );
  const nameById = new Map(nameEntries);

  return rawMessages.map((m: any) => ({
    ts: m.ts,
    user: (m.user && nameById.get(m.user)) ?? m.bot_id ?? "unknown",
    text: m.text ?? "",
  }));
}
