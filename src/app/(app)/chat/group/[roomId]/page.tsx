import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GroupChatRoom from './GroupChatRoom'
import type { Profile } from '@/types'

interface Props {
  params: Promise<{ roomId: string }>
}

export default async function GroupChatPage({ params }: Props) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: room }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('group_chat_rooms').select('id, name, description').eq('id', roomId).single(),
    supabase
      .from('group_chat_messages')
      .select('*, user:profiles(id, name, role)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!profile) redirect('/login')
  if (!room) notFound()

  const { error: readError } = await supabase
    .from('chat_room_reads')
    .upsert(
      { user_id: user.id, room_type: 'group', room_id: roomId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,room_type,room_id' }
    )
  if (readError) console.error('단체 채팅방 읽음 상태 기록 실패:', readError)

  return <GroupChatRoom profile={profile as Profile} room={room} initialMessages={(messages ?? []).reverse()} />
}
