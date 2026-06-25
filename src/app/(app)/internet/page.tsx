import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InternetClient from './InternetClient'

export default async function InternetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows, error } = await supabase
    .from('internet_management')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">인터넷 관리</h1>
        <p className="text-sm text-slate-500 mt-0.5">인터넷 개통 관리대장</p>
      </div>
      {error ? (
        <div className="text-red-500 text-sm">데이터를 불러오지 못했습니다: {error.message}</div>
      ) : (
        <InternetClient rows={rows ?? []} />
      )}
    </div>
  )
}
