import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BlueprintsListClient from './BlueprintsListClient'
import type { Profile } from '@/types'

export default async function BlueprintsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: blueprints },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('install_blueprints')
      .select('id, title, merchant_id, updated_at, created_at, merchant:merchants(business_name)')
      .order('updated_at', { ascending: false })
      .limit(300),
  ])

  if (!profile) redirect('/dashboard')

  return (
    <BlueprintsListClient
      profile={profile as Profile}
      initialBlueprints={(blueprints as any) ?? []}
    />
  )
}
