import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { STATUS_LABEL, type TicketStatus, type Profile } from '@/types'
import TicketsClient from './TicketsClient'

interface Props {
  searchParams: Promise<{ status?: string; tab?: string }>
}

const TRANSFERRED_STATUSES: TicketStatus[] = ['cs_pending', 'cs_progress', 'scheduled', 'tech_pending', 'in_progress', 'done', 'canceled']

const TAB_STATUSES: Record<string, TicketStatus[]> = {
  sales: ['sales'],
  transferred: TRANSFERRED_STATUSES,
  cs: ['cs_pending', 'cs_progress', 'scheduled'],
  tech: ['in_progress'],
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

  // 역할별 필터
  if (p.role === 'sales') query = query.eq('sales_id', user.id)
  if (p.role === 'cs') query = query.eq('cs_id', user.id)
  if (p.role === 'tech') query = query.eq('tech_id', user.id)

  // 탭별 상태 필터
  if (params.status) {
    query = query.eq('status', params.status)
  } else if (tab !== 'all') {
    query = query.in('status', TAB_STATUSES[tab] ?? [])
  }

  const { data: tickets } = await query

  // 탭 구성 (영업팀은 이관완료 탭 추가)
  const TABS = p.role === 'sales' || p.role === 'admin'
    ? [
        { key: 'all', label: '전체' },
        { key: 'sales', label: '접수중' },
        { key: 'transferred', label: '이관완료' },
        { key: 'cs', label: 'CS팀' },
        { key: 'tech', label: '기술지원' },
      ]
    : p.role === 'cs'
    ? [
        { key: 'all', label: '전체' },
        { key: 'cs', label: 'CS 진행' },
        { key: 'tech', label: '기술지원' },
      ]
    : [
        { key: 'all', label: '전체' },
        { key: 'tech', label: '진행중' },
      ]

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
        {(p.role === 'sales' || p.role === 'cs' || p.role === 'admin') && (
          <Link href="/tickets/new"
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-blue-200">
            <Plus size={16} />새 작업
          </Link>
        )}
      </div>

      {/* 탭 */}
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
      {statusFilters.length > 0 && (
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
      )}

      {/* 목록 */}
      <TicketsClient tickets={(tickets ?? []) as any} />
    </div>
  )
}
