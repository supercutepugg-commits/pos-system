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

// 알림 생성용: 가맹 접수 일정 라벨
const FRANCHISE_DATE_FIELDS = [
  { key: 'open_date', label: '오픈예정일' },
  { key: 'install_date', label: '설치예정일' },
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
    .select('id, title, scheduled_at, install_date, open_date, card_apply_date, sales_id, cs_id, tech_id, merchant:merchants(business_name)')
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

  const { data: upcomingFranchise } = await supabase
    .from('franchise_applications')
    .select('id, business_name, open_date, install_date')
    .neq('status', 'franchise_done')
    .or('open_date.not.is.null,install_date.not.is.null')

  // 담당자 지정 여부와 무관하게 전체 직원에게 알림
  const { data: allProfiles } = await supabase.from('profiles').select('id')
  const allUserIds = (allProfiles ?? []).map(p => p.id)

  // 캘린더 일정(티켓/가맹) → notifications 테이블에 실제 알림 행 생성 (중복 방지)
  type ScheduleItem = { refType: 'ticket' | 'franchise'; refId: string; type: string; title: string; body: string; targetUserIds: string[] }
  const scheduleItems: ScheduleItem[] = []

  for (const t of (upcomingTickets ?? []) as any[]) {
    for (const f of SCHEDULE_FIELDS) {
      const raw = t[f.key] as string | null
      if (!raw) continue
      const date = raw.slice(0, 10)
      if (date < todayStr || date > limitStr) continue
      const name = t.merchant?.business_name ?? t.title
      scheduleItems.push({
        refType: 'ticket', refId: t.id, type: `schedule_${f.key}`,
        title: `${f.label}: ${name}`, body: `${date} 예정`, targetUserIds: allUserIds,
      })
    }
  }

  for (const f of (upcomingFranchise ?? []) as any[]) {
    for (const ff of FRANCHISE_DATE_FIELDS) {
      const raw = f[ff.key] as string | null
      if (!raw) continue
      const date = raw.slice(0, 10)
      if (date < todayStr || date > limitStr) continue
      const name = f.business_name || '상호명 미입력'
      scheduleItems.push({
        refType: 'franchise', refId: f.id, type: `schedule_${ff.key}`,
        title: `${ff.label}: ${name}`, body: `${date} 예정`, targetUserIds: allUserIds,
      })
    }
  }

  if (scheduleItems.length > 0) {
    const ticketIds = [...new Set(scheduleItems.filter(i => i.refType === 'ticket').map(i => i.refId))]
    const franchiseIds = [...new Set(scheduleItems.filter(i => i.refType === 'franchise').map(i => i.refId))]

    const [{ data: existingTicketNotifs }, { data: existingFranchiseNotifs }] = await Promise.all([
      ticketIds.length > 0
        ? supabase.from('notifications').select('user_id, ticket_id, type').in('ticket_id', ticketIds)
        : Promise.resolve({ data: [] as any[] }),
      franchiseIds.length > 0
        ? supabase.from('notifications').select('user_id, franchise_application_id, type').in('franchise_application_id', franchiseIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const existingKeys = new Set([
      ...(existingTicketNotifs ?? []).map((n: any) => `${n.user_id}:ticket:${n.ticket_id}:${n.type}`),
      ...(existingFranchiseNotifs ?? []).map((n: any) => `${n.user_id}:franchise:${n.franchise_application_id}:${n.type}`),
    ])

    const rowsToInsert = scheduleItems.flatMap(item =>
      item.targetUserIds
        .filter(uid => !existingKeys.has(`${uid}:${item.refType}:${item.refId}:${item.type}`))
        .map(uid => ({
          user_id: uid,
          ticket_id: item.refType === 'ticket' ? item.refId : null,
          franchise_application_id: item.refType === 'franchise' ? item.refId : null,
          type: item.type,
          title: item.title,
          body: item.body,
          is_read: false,
        }))
    )

    if (rowsToInsert.length > 0) {
      const { error: notifyInsertError } = await supabase.from('notifications').insert(rowsToInsert)
      if (notifyInsertError) console.error('일정 알림 생성 실패:', notifyInsertError.message)
    }
  }

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

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
