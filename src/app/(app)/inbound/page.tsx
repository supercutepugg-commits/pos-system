import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboundClient from './InboundClient'

export default async function InboundPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Supabase 기본 limit 1000 → 전체 페이징
  const PAGE = 1000
  let allRows: any[] = []
  let from = 0
  let fetchError = null
  while (true) {
    const { data, error: err } = await supabase
      .from('crm_inbound')
      .select('*')
      .order('date', { ascending: false })
      .range(from, from + PAGE - 1)
    if (err) { fetchError = err; break }
    if (data) allRows = allRows.concat(data)
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  const rows = allRows
  const error = fetchError

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
        <InboundClient rows={rows ?? []} />
      )}
    </div>
  )
}
