import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, type TicketStatus, type TicketType, type Priority, type Profile } from '@/types'
import TicketActions from './TicketActions'
import TicketLogs from './TicketLogs'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      merchant:merchants(*),
      sales:profiles!tickets_sales_id_fkey(*),
      cs:profiles!tickets_cs_id_fkey(*),
      tech:profiles!tickets_tech_id_fkey(*)
    `)
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const { data: logs } = await supabase
    .from('ticket_logs')
    .select('*, user:profiles(*)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })

  const { data: techUsers } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .eq('role', 'tech')

  const { data: csUsers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'cs')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
            {STATUS_LABEL[ticket.status as TicketStatus]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[ticket.priority as Priority]}`}>
            {PRIORITY_LABEL[ticket.priority as Priority]}
          </span>
          <span className="text-xs text-gray-500">{TYPE_LABEL[ticket.type as TicketType]}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          등록 {format(new Date(ticket.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
        </p>
      </div>

      {/* 가맹점 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">가맹점 정보</h2>
        <div className="grid grid-cols-2 gap-y-2.5 text-sm">
          <div>
            <p className="text-xs text-gray-400">상호명</p>
            <p className="font-medium">{(ticket.merchant as any)?.business_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">대표자</p>
            <p className="font-medium">{(ticket.merchant as any)?.owner_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">연락처</p>
            <p className="font-medium">{(ticket.merchant as any)?.phone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">포스 기종</p>
            <p className="font-medium">{(ticket.merchant as any)?.pos_model ?? '-'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-400">주소</p>
            <p className="font-medium">{(ticket.merchant as any)?.address} {(ticket.merchant as any)?.address_detail}</p>
          </div>
        </div>
      </div>

      {/* 담당자 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">담당자</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">영업</p>
            <p className="font-medium">{(ticket.sales as any)?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">CS</p>
            <p className="font-medium">{(ticket.cs as any)?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">기사</p>
            <p className="font-medium">{(ticket.tech as any)?.name ?? '-'}</p>
          </div>
        </div>
        {ticket.scheduled_at && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">예약 일정</p>
            <p className="font-medium text-sm">
              {format(new Date(ticket.scheduled_at), 'yyyy년 M월 d일 (EEE) HH:mm', { locale: ko })}
            </p>
          </div>
        )}
      </div>

      {ticket.memo && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">메모</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.memo}</p>
        </div>
      )}

      {/* 액션 버튼들 */}
      <TicketActions
        ticket={ticket as any}
        profile={profile as Profile}
        techUsers={techUsers ?? []}
        csUsers={csUsers ?? []}
      />

      {/* 작업 이력 */}
      <TicketLogs logs={logs ?? []} />
    </div>
  )
}
