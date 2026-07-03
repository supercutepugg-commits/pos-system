import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FranchiseClient from './FranchiseClient'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function FranchisePage({ searchParams }: Props) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rows, error }, { data: salesProfiles }, { data: csProfiles }] = await Promise.all([
    supabase
      .from('franchise_applications')
      .select('*, sales:profiles!franchise_applications_sales_id_fkey(id,name,role), cs:profiles!franchise_applications_cs_id_fkey(id,name,role), creator:profiles!franchise_applications_created_by_fkey(id,name,role)')
      .order('updated_at', { ascending: false }),
    supabase.from('profiles').select('id,name,role').in('role', ['sales', 'admin']).order('name'),
    supabase.from('profiles').select('id,name,role').in('role', ['cs', 'admin']).order('name'),
  ])

  // franchise_application_id → { id, status } 맵
  const linkedInstalls: Record<string, { id: string; status: string }> = {}
  if (rows && rows.length > 0) {
    const { data: installs } = await supabase
      .from('installations')
      .select('id, status, franchise_application_id')
      .in('franchise_application_id', rows.map(r => r.id))
    for (const inst of installs ?? []) {
      if (inst.franchise_application_id) linkedInstalls[inst.franchise_application_id] = { id: inst.id, status: inst.status }
    }
  }

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">가맹 접수</h1>
        <p className="text-sm text-slate-500 mt-0.5">영업 정보입력 → 서류대기 → 서류미비/접수완료 → 가맹완료</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <FranchiseClient rows={rows ?? []} salesProfiles={salesProfiles ?? []} csProfiles={csProfiles ?? []} currentUserId={user.id} initialStatusFilter={status ?? ''} linkedInstalls={linkedInstalls} />
      )}
    </div>
  )
}
