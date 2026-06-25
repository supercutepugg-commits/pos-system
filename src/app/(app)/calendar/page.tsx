import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tickets }, { data: franchiseRows }] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, title, type, status, scheduled_at, install_date, open_date, card_apply_date, merchant:merchants(business_name), tech:profiles!tickets_tech_id_fkey(name), sales:profiles!tickets_sales_id_fkey(name)')
      .not('status', 'eq', 'canceled')
      .or('scheduled_at.not.is.null,install_date.not.is.null,open_date.not.is.null,card_apply_date.not.is.null'),
    supabase
      .from('franchise_applications')
      .select('id, business_name, status, open_date, install_date, sales:profiles!franchise_applications_sales_id_fkey(name)')
      .neq('status', 'franchise_done')
      .or('open_date.not.is.null,install_date.not.is.null'),
  ])

  return (
    <div className="flex flex-col p-6 h-screen gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">캘린더</h1>
        <p className="text-sm text-slate-500 mt-0.5">설치·일정 관리</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <CalendarClient tickets={(tickets ?? []) as any} franchiseRows={(franchiseRows ?? []) as any} />
      </div>
    </div>
  )
}
