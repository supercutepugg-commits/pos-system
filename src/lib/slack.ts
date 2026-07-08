export interface SlackMessage {
  ts: string
  user: string
  text: string
}

export async function fetchSlackMessages(channel: string, limit = 50): Promise<SlackMessage[]> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN이 설정되지 않았습니다')

  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack API 오류: ${data.error}`)

  return (data.messages ?? []).map((m: any) => ({
    ts: m.ts,
    user: m.user ?? m.bot_id ?? 'unknown',
    text: m.text ?? '',
  }))
}
