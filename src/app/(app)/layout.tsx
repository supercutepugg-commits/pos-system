import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import RealtimeNotification from '@/components/layout/RealtimeNotification'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  // 읽지 않은 DM 수 (내가 속한 채팅방의 내가 보내지 않은 메시지)
  const { data: myRooms } = await supabase
    .from('dm_rooms')
    .select('id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  const roomIds = myRooms?.map(r => r.id) ?? []
  let unreadDmCount = 0
  if (roomIds.length > 0) {
    const { count } = await supabase
      .from('dm_messages')
      .select('*', { count: 'exact', head: true })
      .in('room_id', roomIds)
      .neq('user_id', user.id)
      .eq('is_read', false)
    unreadDmCount = count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="hidden md:flex">
        <Sidebar profile={profile as Profile} unreadCount={unreadCount ?? 0} unreadDmCount={unreadDmCount} />
      </div>
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
      <div className="md:hidden">
        <MobileNav role={(profile as Profile).role} unreadCount={unreadCount ?? 0} />
      </div>
      <RealtimeNotification userId={user.id} initialCount={unreadCount ?? 0} />
    </div>
  )
}
