import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireMaster } from '@/lib/auth/require-admin'
import LogsClient from './LogsClient'
import type { ComponentProps } from 'react'

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const authError = await requireMaster()
  if (authError) redirect('/dashboard')

  const { date } = await searchParams
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null

  const supabase = await createClient()
  let query = supabase
    .from('franchise_application_logs')
    .select('id, from_status, to_status, created_at, user_name, user:profiles(name), franchise_application:franchise_applications(id, business_name, owner_name)')
    .order('created_at', { ascending: false })

  if (selectedDate) {
    const start = new Date(`${selectedDate}T00:00:00`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
  } else {
    query = query.limit(300)
  }

  const { data: logs } = await query

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">직원 활동 로그</h1>
        <p className="text-slate-500 text-sm mt-1">
          {selectedDate ? `${selectedDate} 처리 이력` : '가맹접수 상태변경 이력 (최근 300건)'}
        </p>
      </div>

      <LogsClient logs={(logs ?? []) as unknown as ComponentProps<typeof LogsClient>['logs']} selectedDate={selectedDate} />
    </div>
  )
}
