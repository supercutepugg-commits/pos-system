import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, type TicketStatus, type TicketType, type Priority, type Profile } from '@/types'

interface Props {
  searchParams: Promise<{ status?: string; type?: string }>
}

export default async function TicketsPage({ searchParams }: Props) {
  const params = await searchParams
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
  if (params.type) query = query.eq('type', params.type)
  if (p.role === 'sales') query = query.eq('sales_id', user.id)
  if (p.role === 'tech') query = query.eq('tech_id', user.id)

  const { data: tickets } = await query

  const statuses: TicketStatus[] = ['sales', 'cs_pending', 'cs_progress', 'scheduled', 'tech_pending', 'in_progress', 'done', 'canceled']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">작업 목록</h1>
        {(p.role === 'sales' || p.role === 'admin') && (
          <Link
            href="/tickets/new"
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={16} />
            새 작업
          </Link>
        )}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <Link
          href="/tickets"
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!params.status ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          전체
        </Link>
        {statuses.map(s => (
          <Link
            key={s}
            href={`/tickets?status=${s}`}
            className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${params.status === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {tickets?.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">작업이 없습니다</p>
        )}
        {tickets?.map(ticket => (
          <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
                  {STATUS_LABEL[ticket.status as TicketStatus]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[ticket.priority as Priority]}`}>
                  {PRIORITY_LABEL[ticket.priority as Priority]}
                </span>
                <span className="text-xs text-gray-500">{TYPE_LABEL[ticket.type as TicketType]}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{(ticket.merchant as any)?.business_name}</span>
                {ticket.scheduled_at && (
                  <span>예약: {format(new Date(ticket.scheduled_at), 'M/d HH:mm', { locale: ko })}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">{format(new Date(ticket.created_at), 'M/d', { locale: ko })}</p>
              {(ticket.tech as any)?.name && (
                <p className="text-xs text-gray-500 mt-1">{(ticket.tech as any).name}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
