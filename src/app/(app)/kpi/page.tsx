import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  addKpiPenalty,
  buildKpiScores,
  businessHoursBetween,
  type KpiProfile,
  type KpiScore,
} from '@/lib/kpi'

function scoreTone(score: number) {
  if (score >= 90) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (score >= 80) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (score >= 70) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

function currentKpiPeriod() {
  const nowValue = Date.now()
  const now = new Date(nowValue + 9 * 60 * 60 * 1000)
  return {
    monthStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 9 * 60 * 60 * 1000).toISOString(),
    today: now.toISOString().slice(0, 10),
    staleBefore: new Date(nowValue - 3 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export default async function KpiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id,name,role,approval_role')
    .eq('id', user.id)
    .single()
  if (!currentProfile) redirect('/dashboard')

  const { monthStart, today, staleBefore } = currentKpiPeriod()
  const [
    { data: profiles },
    { data: transferApprovals },
    { data: installationApprovals },
    { data: staleFranchise },
    { data: overdueInstalls },
    { data: rejectedInstalls },
  ] = await Promise.all([
    supabase.from('profiles').select('id,name,role,approval_role'),
    supabase.from('franchise_transfer_approvals')
      .select('requested_by,requested_at,cs_approved_by,cs_approved_at,status')
      .gte('requested_at', monthStart),
    supabase.from('installation_completion_approvals')
      .select('requested_by,requested_at,responsible_approved_by,responsible_approved_at,status')
      .gte('requested_at', monthStart),
    supabase.from('franchise_applications')
      .select('cs_id')
      .not('cs_id', 'is', null)
      .not('status', 'in', '(card_done,internet_done,toss_review_done,completed)')
      .lt('updated_at', staleBefore),
    supabase.from('installations')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .not('status', 'in', '(completed,rejected)')
      .lt('scheduled_date', today),
    supabase.from('installations')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .eq('status', 'rejected')
      .gte('updated_at', monthStart),
  ])

  const penalties = new Map<string, number>()
  for (const approval of transferApprovals ?? []) {
    if (approval.status === 'rejected') addKpiPenalty(penalties, approval.requested_by, 4)
    if (approval.cs_approved_by && approval.cs_approved_at && businessHoursBetween(approval.requested_at, approval.cs_approved_at) > 4) {
      addKpiPenalty(penalties, approval.cs_approved_by, 2)
    }
  }
  for (const approval of installationApprovals ?? []) {
    if (approval.status === 'rejected') addKpiPenalty(penalties, approval.requested_by, 4)
    if (approval.responsible_approved_by && approval.responsible_approved_at && businessHoursBetween(approval.requested_at, approval.responsible_approved_at) > 4) {
      addKpiPenalty(penalties, approval.responsible_approved_by, 2)
    }
  }
  for (const receipt of staleFranchise ?? []) addKpiPenalty(penalties, receipt.cs_id, 2)
  for (const installation of overdueInstalls ?? []) addKpiPenalty(penalties, installation.assigned_to, 4)
  for (const installation of rejectedInstalls ?? []) addKpiPenalty(penalties, installation.assigned_to, 3)

  const scores = buildKpiScores((profiles ?? []) as KpiProfile[], penalties)
  const visibleScores = currentProfile.role === 'master'
    ? scores
    : scores.filter(score => score.userId === user.id)
  const myScore = scores.find(score => score.userId === user.id)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">KPI</h1>
        <p className="mt-1 text-sm text-slate-500">이번 달 개인 KPI 점수입니다.</p>
      </div>

      {currentProfile.role !== 'master' ? (
        myScore ? <PersonalScore score={myScore} /> : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            현재 계정은 KPI 집계 대상이 아닙니다.
          </div>
        )
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-bold text-slate-900">개인 KPI</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleScores.map(score => (
              <div key={score.userId} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{score.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{score.roleLabel}</p>
                </div>
                <span className={`min-w-20 rounded-xl border px-4 py-2 text-center text-lg font-bold ${scoreTone(score.score)}`}>
                  {score.score}점
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function PersonalScore({ score }: { score: KpiScore }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-500">{score.name}</p>
      <p className="mt-1 text-xs text-slate-400">{score.roleLabel}</p>
      <div className={`mx-auto mt-6 flex size-40 items-center justify-center rounded-full border-8 text-4xl font-bold ${scoreTone(score.score)}`}>
        {score.score}점
      </div>
    </section>
  )
}
