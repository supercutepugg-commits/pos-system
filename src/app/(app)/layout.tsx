import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import RealtimeNotification from '@/components/layout/RealtimeNotification'
import ScheduleAlertBanner from '@/components/layout/ScheduleAlertBanner'
import type { Profile } from '@/types'

const SCHEDULE_FIELDS = [
  { key: 'scheduled_at', label: '일정' },
  { key: 'install_date', label: '설치' },
  { key: 'open_date', label: '오픈' },
  { key: 'card_apply_date', label: '카드신청' },
] as const

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

  // 3일 이내(오늘 포함) 다가오는 캘린더 일정 알림
  const todayStr = new Date().toISOString().slice(0, 10)
  const limitStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

  const { data: upcomingTickets } = await supabase
    .from('tickets')
    .select('id, title, scheduled_at, install_date, open_date, card_apply_date, merchant:merchants(business_name)')
    .not('status', 'eq', 'canceled')
    .or('scheduled_at.not.is.null,install_date.not.is.null,open_date.not.is.null,card_apply_date.not.is.null')

  const scheduleAlerts = (upcomingTickets ?? []).flatMap((t: any) =>
    SCHEDULE_FIELDS.flatMap(f => {
      const raw = t[f.key] as string | null
      if (!raw) return []
      const date = raw.slice(0, 10)
      if (date < todayStr || date > limitStr) return []
      return [{
        ticketId: t.id as string,
        label: f.label,
        date,
        name: t.merchant?.business_name ?? t.title,
      }]
    })
  )

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
      <ScheduleAlertBanner alerts={scheduleAlerts} />
    </div>
  )
}
