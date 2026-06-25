import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FRANCHISE_STATUS_LABEL, FRANCHISE_STATUS_COLOR, type FranchiseStatus, type Profile } from '@/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { FileEdit, Clock4, CheckCircle2, Flag, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (!profile) redirect('/login')

  const p = profile as Profile

  let query = supabase
    .from('franchise_applications')
    .select('*, sales:profiles!franchise_applications_sales_id_fkey(name), cs:profiles!franchise_applications_cs_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (p.role === 'sales') query = query.eq('sales_id', userId)
  if (p.role === 'cs') query = query.eq('cs_id', userId)

  const countStatuses: FranchiseStatus[] = ['doc_waiting', 'doc_incomplete', 'card_apply_done', 'toss_review_done']

  function buildCountQuery(status: FranchiseStatus) {
    let q = supabase.from('franchise_applications').select('id', { count: 'exact', head: true }).eq('status', status)
    if (p.role === 'sales') q = q.eq('sales_id', userId)
    if (p.role === 'cs') q = q.eq('cs_id', userId)
    return q
  }

  const [{ data: applications }, ...countResults] = await Promise.all([
    query.limit(10),
    ...countStatuses.map(buildCountQuery),
  ])

  const counts: Record<string, number> = {}
  countStatuses.forEach((status, i) => { counts[status] = countResults[i].count ?? 0 })

  const summaryCards = [
    { label: FRANCHISE_STATUS_LABEL.doc_waiting, status: 'doc_waiting', icon: Clock4, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
    { label: FRANCHISE_STATUS_LABEL.doc_incomplete, status: 'doc_incomplete', icon: FileEdit, color: 'bg-red-50 text-red-600', border: 'border-red-100' },
    { label: FRANCHISE_STATUS_LABEL.card_apply_done, status: 'card_apply_done', icon: CheckCircle2, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100' },
    { label: FRANCHISE_STATUS_LABEL.toss_review_done, status: 'toss_review_done', icon: Flag, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {p.name}님 👋</h1>
        <p className="text-slate-500 mt-1">
          {format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </p>
      </div>

      {/* 상태 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summaryCards.map(({ label, status, icon: Icon, color, border }) => (
          <Link
            key={status}
            href={`/franchise?status=${status}`}
            className={`bg-white rounded-2xl border ${border} p-5 hover:shadow-md transition-all group`}
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={20} />
            </div>
            <p className="text-3xl font-bold text-slate-900">{counts[status] ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* 최근 가맹 접수 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">최근 가맹 접수</h2>
          <Link href="/franchise" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            전체보기 <ArrowRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {applications?.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm">등록된 가맹 접수가 없습니다</p>
              <Link href="/franchise" className="inline-block mt-3 text-sm text-blue-600 hover:underline font-medium">
                가맹 정보 입력하기
              </Link>
            </div>
          )}
          {applications?.map(app => (
            <Link
              key={app.id}
              href="/franchise"
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${FRANCHISE_STATUS_COLOR[app.status as FranchiseStatus]}`}>
                {FRANCHISE_STATUS_LABEL[app.status as FranchiseStatus]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{app.business_name || '상호명 미입력'}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{app.owner_name ?? ''}</p>
              </div>
              <p className="text-xs text-slate-400 whitespace-nowrap">
                {format(new Date(app.created_at), 'M/d', { locale: ko })}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
