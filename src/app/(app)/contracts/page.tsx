import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContractsClient from './ContractsClient'
import type { Profile } from '@/types'

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['cs', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*, creator:profiles!contracts_created_by_fkey(name)')
    .order('created_at', { ascending: false })

  return (
    <ContractsClient
      profile={profile as Profile}
      initialContracts={(contracts as any) ?? []}
    />
  )
}
