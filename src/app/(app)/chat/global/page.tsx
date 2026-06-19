import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatRoom from './ChatRoom'
import type { Profile } from '@/types'

export default async function GlobalChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: messages } = await supabase
    .from('messages')
    .select('*, user:profiles(id, name, role)')
    .order('created_at', { ascending: true })
    .limit(100)

  return <ChatRoom profile={profile as Profile} initialMessages={messages ?? []} />
}
