import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireMaster } from '@/lib/auth/require-admin'
import LogsClient from './LogsClient'

export default async function AdminLogsPage() {
  const authError = await requireMaster()
  if (authError) redirect('/dashboard')

  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('franchise_application_logs')
    .select('id, from_status, to_status, created_at, user:profiles(name), franchise_application:franchise_applications(id, business_name, owner_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">직원 활동 로그</h1>
        <p className="text-slate-500 text-sm mt-1">가맹접수 상태변경 이력 (최근 300건)</p>
      </div>

      <LogsClient logs={(logs ?? []) as any} />
    </div>
  )
}
