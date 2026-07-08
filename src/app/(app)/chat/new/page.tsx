import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ to?: string }>
}

export default async function NewDMPage({ searchParams }: Props) {
  const { to } = await searchParams
  if (!to) redirect('/chat')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = user.id
  const other = to

  // 이미 방이 있는지 확인 (동시에 여러 개 생성된 경우를 대비해 단일 행 강제 조회 대신
  // 가장 오래된 방 하나를 선택)
  const { data: existingRooms } = await supabase
    .from('dm_rooms')
    .select('id')
    .or(`and(user1_id.eq.${me},user2_id.eq.${other}),and(user1_id.eq.${other},user2_id.eq.${me})`)
    .order('created_at', { ascending: true })
    .limit(1)

  const existing = existingRooms?.[0]
  if (existing) {
    redirect(`/chat/dm/${existing.id}`)
  }

  // 새 방 생성
  const u1 = me < other ? me : other
  const u2 = me < other ? other : me
  const { data: room, error } = await supabase
    .from('dm_rooms')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single()

  if (error) {
    console.error('DM 방 생성 실패:', error)
    redirect('/chat?error=dm_room_create_failed')
  }

  if (room) redirect(`/chat/dm/${room.id}`)
  redirect('/chat?error=dm_room_create_failed')
}
