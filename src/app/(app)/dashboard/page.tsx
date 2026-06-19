import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { STATUS_LABEL, STATUS_COLOR, type TicketStatus, type Profile } from '@/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const p = profile as Profile

  // 역할에 따라 필터
  let query = supabase
    .from('tickets')
    .select('*, merchant:merchants(business_name, phone), sales:profiles!tickets_sales_id_fkey(name), cs:profiles!tickets_cs_id_fkey(name), tech:profiles!tickets_tech_id_fkey(name)')
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })

  if (p.role === 'sales') query = query.eq('sales_id', user.id)
  if (p.role === 'cs') query = query.in('status', ['cs_pending', 'cs_progress', 'scheduled'])
  if (p.role === 'tech') query = query.eq('tech_id', user.id)

  const { data: tickets } = await query.limit(20)

  // 상태별 집계
  const { data: allTickets } = await supabase
    .from('tickets')
    .select('status')
    .neq('status', 'canceled')

  const counts: Record<string, number> = {}
  allTickets?.forEach(t => {
    counts[t.status] = (counts[t.status] ?? 0) + 1
  })

  const summaryStatuses: TicketStatus[] = ['sales', 'cs_pending', 'scheduled', 'in_progress', 'done']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </p>
      </div>

      {/* 상태별 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {summaryStatuses.map(status => (
          <Link
            key={status}
            href={`/tickets?status=${status}`}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <p className="text-2xl font-bold text-gray-900">{counts[status] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{STATUS_LABEL[status]}</p>
          </Link>
        ))}
      </div>

      {/* 최근 작업 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">최근 작업</h2>
          <Link href="/tickets" className="text-xs text-blue-600 hover:underline">전체보기</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {tickets?.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-10">작업이 없습니다</p>
          )}
          {tickets?.map(ticket => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
                {STATUS_LABEL[ticket.status as TicketStatus]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                <p className="text-xs text-gray-500 truncate">{(ticket.merchant as any)?.business_name}</p>
              </div>
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {format(new Date(ticket.created_at), 'M/d', { locale: ko })}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
