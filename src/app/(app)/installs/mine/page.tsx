import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstallsClient from '../InstallsClient'
import type { Profile } from '@/types'

export default async function MyInstallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/dashboard')
  if (!['tech', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: installs } = await supabase
    .from('installations')
    .select('*, assignee:profiles!installations_assigned_to_fkey(name), creator:profiles!installations_created_by_fkey(name)')
    .not('assigned_to', 'is', null)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <InstallsClient
      profile={profile as Profile}
      techUsers={[]}
      initialInstalls={(installs as any) ?? []}
      mineOnly
    />
  )
}
