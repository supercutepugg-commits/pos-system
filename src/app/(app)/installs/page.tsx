import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstallsClient from './InstallsClient'
import type { Profile } from '@/types'

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function InstallsPage({ searchParams }: Props) {
  const { id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: installs },
    { data: techUsers },
    { data: completionApprovals },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('installations')
      .select('*, assignee:profiles!installations_assigned_to_fkey(name), creator:profiles!installations_created_by_fkey(name)')
      .neq('delivery_type', 'delivery')
      .order('sort_order', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('profiles').select('id, name').eq('role', 'tech'),
    supabase.from('installation_completion_approvals')
      .select('installation_id,status,target_status,request_payload,requested_by,requested_by_name,responsible_approved_by_name,approved_by,approved_by_name')
      .in('status', ['requested', 'responsible_approved']),
  ])

  if (!profile) redirect('/dashboard')

  return (
    <InstallsClient
      profile={profile as Profile}
      techUsers={techUsers ?? []}
      initialInstalls={(installs as any) ?? []}
      initialHighlightId={id}
      initialCompletionApprovals={Object.fromEntries((completionApprovals ?? []).map(approval => [approval.installation_id, approval]))}
    />
  )
}
