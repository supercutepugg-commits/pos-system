import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstallsClient from './InstallsClient'
import type { Profile } from '@/types'

export default async function InstallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: installs },
    { data: techUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('installations')
      .select('*, assignee:profiles!installations_assigned_to_fkey(name), creator:profiles!installations_created_by_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('profiles').select('id, name').eq('role', 'tech'),
  ])

  if (!profile || !['tech', 'cs', 'admin'].includes(profile.role)) redirect('/dashboard')

  return (
    <InstallsClient
      profile={profile as Profile}
      techUsers={techUsers ?? []}
      initialInstalls={(installs as any) ?? []}
    />
  )
}
