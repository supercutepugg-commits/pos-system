import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MerchantsClient from './MerchantsClient'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function MerchantsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchants, count } = await supabase
    .from('merchants')
    .select('*, sales:profiles!merchants_sales_id_fkey(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">가맹점 ({totalCount})</h1>
      </div>

      <MerchantsClient merchants={(merchants ?? []) as any} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Link
            href={`/merchants?page=${Math.max(1, page - 1)}`}
            className={`text-sm px-3 py-1.5 rounded-lg border border-gray-200 font-medium ${page <= 1 ? 'text-gray-300 pointer-events-none' : 'text-gray-600 hover:bg-gray-50'}`}>
            이전
          </Link>
          <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
          <Link
            href={`/merchants?page=${Math.min(totalPages, page + 1)}`}
            className={`text-sm px-3 py-1.5 rounded-lg border border-gray-200 font-medium ${page >= totalPages ? 'text-gray-300 pointer-events-none' : 'text-gray-600 hover:bg-gray-50'}`}>
            다음
          </Link>
        </div>
      )}
    </div>
  )
}
