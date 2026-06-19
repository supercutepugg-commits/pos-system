'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteTickets(ids: string[]) {
  if (!ids.length) return { error: null }
  const supabase = createAdminClient()
  const { error } = await supabase.from('tickets').delete().in('id', ids)
  return { error: error?.message ?? null }
}
