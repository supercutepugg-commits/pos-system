import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatRoom from './ChatRoom'
import type { Profile } from '@/types'


const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000000'

export default async function GlobalChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: messages } = await supabase
    .from('messages')
    .select('*, user:profiles(id, name, role)')
    .order('created_at', { ascending: true })
    .limit(100)

  
  const { error: readError } = await supabase
    .from('chat_room_reads')
    .upsert(
      { user_id: user.id, room_type: 'global', room_id: GLOBAL_ROOM_ID, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,room_type,room_id' }
    )
  if (readError) console.error('읽음 상태 기록 실패:', readError)

  return <ChatRoom profile={profile as Profile} initialMessages={messages ?? []} />
}
