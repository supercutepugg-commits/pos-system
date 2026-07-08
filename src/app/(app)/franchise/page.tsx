import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FranchiseClient from './FranchiseClient'

interface Props {
  searchParams: Promise<{ status?: string; highlight?: string }>
}

export default async function FranchisePage({ searchParams }: Props) {
  const { status, highlight } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rows, error }, { data: salesProfiles }, { data: csProfiles }, { data: currentProfile }] = await Promise.all([
    supabase
      .from('franchise_applications')
      .select('*, sales:profiles!franchise_applications_sales_id_fkey(id,name,role), cs:profiles!franchise_applications_cs_id_fkey(id,name,role), creator:profiles!franchise_applications_created_by_fkey(id,name,role)')
      .order('updated_at', { ascending: false }),
    supabase.from('profiles').select('id,name,role').in('role', ['sales', 'admin']).order('name'),
    supabase.from('profiles').select('id,name,role').in('role', ['cs', 'admin']).order('name'),
    supabase.from('profiles').select('name,role').eq('id', user.id).single(),
  ])

  // franchise_application_id → { id, status } 맵
  const linkedInstalls: Record<string, { id: string; status: string }> = {}
  const linkedInternets: Record<string, { id: string; status: string | null; category: string | null }> = {}
  if (rows && rows.length > 0) {
    const phones = [...new Set(rows.map(r => r.phone).filter((p): p is string => !!p))]
    const [{ data: installs }, { data: internetsById }, { data: internetsByPhone }] = await Promise.all([
      supabase
        .from('installations')
        .select('id, status, franchise_application_id')
        .in('franchise_application_id', rows.map(r => r.id)),
      supabase
        .from('internet_management')
        .select('id, status, category, franchise_application_id')
        .in('franchise_application_id', rows.map(r => r.id)),
      // franchise_application_id 없이 인터넷관리 탭에서 직접 등록된 건은 연락처로 매칭
      phones.length > 0
        ? supabase.from('internet_management').select('id, status, category, phone').is('franchise_application_id', null).in('phone', phones)
        : Promise.resolve({ data: [] as { id: string; status: string | null; category: string | null; phone: string | null }[] }),
    ])
    for (const inst of installs ?? []) {
      if (inst.franchise_application_id) linkedInstalls[inst.franchise_application_id] = { id: inst.id, status: inst.status }
    }
    for (const net of internetsById ?? []) {
      if (net.franchise_application_id) linkedInternets[net.franchise_application_id] = { id: net.id, status: net.status, category: net.category }
    }
    const normalizePhone = (p: string) => p.replace(/\D/g, '')
    const phoneToFranchiseId = new Map(rows.filter(r => r.phone).map(r => [normalizePhone(r.phone as string), r.id]))
    for (const net of internetsByPhone ?? []) {
      const fid = net.phone ? phoneToFranchiseId.get(normalizePhone(net.phone)) : undefined
      if (fid && !linkedInternets[fid]) linkedInternets[fid] = { id: net.id, status: net.status, category: net.category }
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
        <FranchiseClient rows={rows ?? []} salesProfiles={salesProfiles ?? []} csProfiles={csProfiles ?? []} currentUserId={user.id} currentUserName={currentProfile?.name ?? ''} currentUserRole={currentProfile?.role ?? ''} initialStatusFilter={status ?? ''} initialHighlightId={highlight} linkedInstalls={linkedInstalls} linkedInternets={linkedInternets} />
      )}
    </div>
  )
}
