'use server'

import { createClient } from '@/lib/supabase/server'

export async function deleteTickets(ids: string[]) {
  if (!ids.length) return { error: null }
  const supabase = await createClient()
  const { error } = await supabase.from('tickets').delete().in('id', ids)
  return { error: error?.message ?? null }
}
