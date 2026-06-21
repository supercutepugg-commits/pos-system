'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'

const CHUNK_SIZE = 100

export async function deleteMerchants(ids: string[]) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }
  if (!ids.length) return { error: null }
  const supabase = createAdminClient()
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('merchants').delete().in('id', chunk)
    if (error) return { error: error.message }
  }
  return { error: null }
}
