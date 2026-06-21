import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MerchantsClient from './MerchantsClient'

export default async function MerchantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchants } = await supabase
    .from('merchants')
    .select('*, sales:profiles!merchants_sales_id_fkey(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">가맹점 ({merchants?.length ?? 0})</h1>
      </div>

      <MerchantsClient merchants={(merchants ?? []) as any} />
    </div>
  )
}
