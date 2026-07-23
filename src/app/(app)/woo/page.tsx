import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WooClient from './WooClient'

export default async function WooPage({ searchParams }: { searchParams: Promise<{ highlight?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { highlight } = await searchParams

  const { data: rows, error } = await supabase
    .from('woo_customers')
    .select('*')
    .order('created_at', { ascending: false })

  const linkedInstalls: Record<string, { id: string; status: string }> = {}
  if (rows && rows.length > 0) {
    const { data: installs } = await supabase
      .from('installations')
      .select('id, status, woo_customer_id')
      .in('woo_customer_id', rows.map(r => r.id))
    for (const inst of installs ?? []) {
      if (inst.woo_customer_id) linkedInstalls[inst.woo_customer_id] = { id: inst.id, status: inst.status }
    }
  }

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">우국상 관리</h1>
        <p className="text-sm text-slate-500 mt-0.5">우리동네국민상회 고객관리대장 CRM</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <WooClient rows={rows ?? []} currentUserId={user.id} linkedInstalls={linkedInstalls} initialHighlightId={highlight} />
      )}
    </div>
  )
}
