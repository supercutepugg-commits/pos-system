import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewTicketForm from './NewTicketForm'

export default async function NewTicketPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'sales' && profile.role !== 'admin')) redirect('/tickets')

  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, business_name, phone')
    .order('business_name')

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">새 작업 등록</h1>
      <NewTicketForm merchants={merchants ?? []} salesId={user.id} />
    </div>
  )
}
