import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DMChatRoom from './DMChatRoom'
import type { Profile } from '@/types'

interface Props {
  params: Promise<{ roomId: string }>
}

export default async function DMChatPage({ params }: Props) {
  const { roomId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: room },
    { data: messages },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('dm_rooms')
      .select('*, user1:profiles!dm_rooms_user1_id_fkey(id,name,role), user2:profiles!dm_rooms_user2_id_fkey(id,name,role)')
      .eq('id', roomId)
      .single(),
    supabase
      .from('dm_messages')
      .select('*, user:profiles(id, name, role)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  if (!profile) redirect('/login')
  if (!room) notFound()

  const otherUser = (room.user1 as any).id === user.id ? room.user2 as any : room.user1 as any

  
  const { error: readError } = await supabase
    .from('chat_room_reads')
    .upsert(
      { user_id: user.id, room_type: 'dm', room_id: roomId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,room_type,room_id' }
    )
  if (readError) console.error('읽음 상태 기록 실패:', readError)

  return <DMChatRoom profile={profile as Profile} otherUser={otherUser} roomId={roomId} initialMessages={messages ?? []} />
}
