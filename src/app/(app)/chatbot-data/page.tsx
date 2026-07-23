import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatbotDataClient from './ChatbotDataClient'

export default async function ChatbotDataPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('chatbot_training_data').select('*').order('updated_at', { ascending: false }),
  ])

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">챗봇 데이터 수집</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          반복되는 문제상황과 해결방법을 챗봇 학습 데이터로 관리합니다.
        </p>
      </div>
      {error ? (
        <div className="text-sm text-red-500">
          데이터를 불러오지 못했습니다: {error.message}
        </div>
      ) : (
        <ChatbotDataClient rows={rows ?? []} profile={profile} />
      )}
    </div>
  )
}
