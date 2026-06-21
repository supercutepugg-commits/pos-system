'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const CHUNK_SIZE = 100

export async function updateInboundRow(id: string, patch: Record<string, string | null>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('crm_inbound').update(patch).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteInboundRows(ids: string[]) {
  if (!ids.length) return { error: null }
  const supabase = createAdminClient()
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('crm_inbound').delete().in('id', chunk)
    if (error) return { error: error.message }
  }
  return { error: null }
}
