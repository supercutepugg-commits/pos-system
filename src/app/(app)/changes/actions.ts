'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrCs } from '@/lib/auth/require-admin'

export async function deleteChangeRequests(ids: string[]) {
  const authError = await requireAdminOrCs()
  if (authError) return { error: authError }
  if (!ids.length) return { error: null }
  const supabase = createAdminClient()
  const { error } = await supabase.from('change_requests').delete().in('id', ids)
  return { error: error?.message ?? null }
}
