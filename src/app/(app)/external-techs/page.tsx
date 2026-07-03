import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExternalTechsClient from './ExternalTechsClient'

export default async function ExternalTechsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'cs', 'tech'].includes(profile.role)) redirect('/dashboard')

  const { data: techs } = await supabase
    .from('external_techs')
    .select('*')
    .order('created_at', { ascending: false })

  return <ExternalTechsClient initialTechs={techs ?? []} currentUserRole={profile.role} />
}
