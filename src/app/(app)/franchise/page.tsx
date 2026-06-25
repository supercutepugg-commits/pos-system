import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FranchiseClient from './FranchiseClient'

export default async function FranchisePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rows, error }, { data: salesProfiles }] = await Promise.all([
    supabase
      .from('franchise_applications')
      .select('*, sales:profiles!franchise_applications_sales_id_fkey(id,name,role), cs:profiles!franchise_applications_cs_id_fkey(id,name,role)')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,name,role').in('role', ['sales', 'admin']).order('name'),
  ])

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">가맹 접수</h1>
        <p className="text-sm text-slate-500 mt-0.5">영업 정보입력 → 서류대기 → 서류미비/접수완료 → 가맹완료</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <FranchiseClient rows={rows ?? []} salesProfiles={salesProfiles ?? []} />
      )}
    </div>
  )
}
