import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, ChevronRight } from 'lucide-react'
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, type TicketStatus, type TicketType, type Priority, type Profile } from '@/types'

interface Props {
  searchParams: Promise<{ status?: string; tab?: string }>
}

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'sales', label: '영업' },
  { key: 'cs', label: 'CS팀' },
  { key: 'tech', label: '기술지원' },
]

const TAB_STATUSES: Record<string, TicketStatus[]> = {
  sales: ['sales'],
  cs: ['cs_pending', 'cs_progress', 'scheduled'],
  tech: ['tech_pending', 'in_progress'],
}

export default async function TicketsPage({ searchParams }: Props) {
  const params = await searchParams
  const tab = params.tab ?? 'all'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const p = profile as Profile

  let query = supabase
    .from('tickets')
    .select('*, merchant:merchants(business_name, phone), sales:profiles!tickets_sales_id_fkey(name), tech:profiles!tickets_tech_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (tab !== 'all' && !params.status) query = query.in('status', TAB_STATUSES[tab] ?? [])
  if (p.role === 'sales') query = query.eq('sales_id', user.id)
  if (p.role === 'cs') query = query.eq('cs_id', user.id)
  if (p.role === 'tech') query = query.eq('tech_id', user.id)

  const { data: tickets } = await query

  const statusFilters: TicketStatus[] = tab === 'all'
    ? ['sales', 'cs_pending', 'cs_progress', 'scheduled', 'tech_pending', 'in_progress', 'done', 'canceled']
    : (TAB_STATUSES[tab] ?? [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">작업 목록</h1>
          <p className="text-slate-500 text-sm mt-1">총 {tickets?.length ?? 0}건</p>
        </div>
        {(p.role === 'sales' || p.role === 'admin') && (
          <Link href="/tickets/new"
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-blue-200">
            <Plus size={16} />새 작업
          </Link>
        )}
      </div>

      {/* 팀 탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {TABS.map(t => (
          <Link key={t.key} href={`/tickets?tab=${t.key}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        <Link href={`/tickets?tab=${tab}`}
          className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-full font-semibold transition-all ${!params.status ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          전체
        </Link>
        {statusFilters.map(s => (
          <Link key={s} href={`/tickets?tab=${tab}&status=${s}`}
            className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-full font-semibold transition-all ${params.status === s ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {tickets?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">작업이 없습니다</p>
          </div>
        )}
        <div className="divide-y divide-slate-50">
          {tickets?.map(ticket => (
            <Link key={ticket.id} href={`/tickets/${ticket.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
                    {STATUS_LABEL[ticket.status as TicketStatus]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PRIORITY_COLOR[ticket.priority as Priority]}`}>
                    {PRIORITY_LABEL[ticket.priority as Priority]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{TYPE_LABEL[ticket.type as TicketType]}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{ticket.title}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-medium">{(ticket.merchant as any)?.business_name}</span>
                  {ticket.scheduled_at && (
                    <span>📅 {format(new Date(ticket.scheduled_at), 'M/d HH:mm', { locale: ko })}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <p className="text-xs text-slate-400">{format(new Date(ticket.created_at), 'M/d', { locale: ko })}</p>
                  {(ticket.tech as any)?.name && (
                    <p className="text-xs text-slate-500 mt-1 font-medium">{(ticket.tech as any).name}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
