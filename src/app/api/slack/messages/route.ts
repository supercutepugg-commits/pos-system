import { NextResponse } from 'next/server'
import { fetchSlackMessages } from '@/lib/slack'

const SLACK_CHANNEL_ID = 'C06KTK05F0B'

export async function GET() {
  try {
    const messages = await fetchSlackMessages(SLACK_CHANNEL_ID)
    return NextResponse.json({ messages })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
