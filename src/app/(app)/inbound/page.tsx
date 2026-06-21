import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboundClient from './InboundClient'

const PAGE_SIZE = 100

interface Props {
  searchParams: Promise<{
    page?: string
    q?: string
    staff?: string
    channel?: string
    category?: string
    status?: string
    from?: string
    to?: string
    sort?: string
    dir?: string
  }>
}

const SORTABLE = new Set(['date', 'staff', 'channel', 'category', 'status', 'owner_name', 'business_name', 'phone'])

export default async function InboundPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = Math.max(1, Number(params.page) || 1)
  const sortKey = SORTABLE.has(params.sort ?? '') ? params.sort! : 'date'
  const sortDir = params.dir === 'asc' ? 'asc' : 'desc'

  function applyFilters(q: any): any {
    let query = q
    if (params.staff) query = query.eq('staff', params.staff)
    if (params.channel) query = query.eq('channel', params.channel)
    if (params.category) query = query.eq('category', params.category)
    if (params.status) query = query.eq('status', params.status)
    if (params.from) query = query.gte('date', params.from)
    if (params.to) query = query.lte('date', params.to)
    if (params.q) {
      const term = `%${params.q}%`
      query = query.or(
        `business_name.ilike.${term},owner_name.ilike.${term},phone.ilike.${term},inquiry.ilike.${term},staff.ilike.${term}`
      )
    }
    return query
  }

  const [rowsResult, optionsResult] = await Promise.all([
    applyFilters(supabase.from('crm_inbound').select('*', { count: 'exact' }))
      .order(sortKey, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('crm_inbound').select('staff, channel, category, status'),
  ])

  const { data: rows, count, error } = rowsResult as any
  const totalCount: number = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const options: any[] = optionsResult.data ?? []
  const staffs = [...new Set(options.map(r => r.staff).filter(Boolean))].sort() as string[]
  const channels = [...new Set(options.map(r => r.channel).filter(Boolean))].sort() as string[]
  const categories = [...new Set(options.map(r => r.category).filter(Boolean))].sort() as string[]
  const statuses = [...new Set(options.map(r => r.status).filter(Boolean))].sort() as string[]

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">인입 내역</h1>
          <p className="text-sm text-slate-500 mt-0.5">고객 인입 문의 전체 내역</p>
        </div>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <InboundClient
          rows={rows ?? []}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          filterOptions={{ staffs, channels, categories, statuses }}
          currentParams={params}
          sortKey={sortKey}
          sortDir={sortDir}
        />
      )}
    </div>
  )
}
