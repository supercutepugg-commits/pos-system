import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WooClient from './WooClient'

export default async function WooPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows, error } = await supabase
    .from('woo_customers')
    .select('*')
    .order('sort_order', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">우국상 관리</h1>
        <p className="text-sm text-slate-500 mt-0.5">우리동네국민상회 고객관리대장 CRM</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <WooClient rows={rows ?? []} />
      )}
    </div>
  )
}
