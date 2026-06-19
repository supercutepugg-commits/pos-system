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

  // 이미 방이 있는지 확인
  const { data: existing } = await supabase
    .from('dm_rooms')
    .select('id')
    .or(`and(user1_id.eq.${me},user2_id.eq.${other}),and(user1_id.eq.${other},user2_id.eq.${me})`)
    .single()

  if (existing) {
    redirect(`/chat/dm/${existing.id}`)
  }

  // 새 방 생성
  const u1 = me < other ? me : other
  const u2 = me < other ? other : me
  const { data: room } = await supabase
    .from('dm_rooms')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single()

  if (room) redirect(`/chat/dm/${room.id}`)
  redirect('/chat')
}
