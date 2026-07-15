'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDeletePermission } from '@/lib/auth/require-admin'

export async function deleteInstallations(ids: string[]) {
  const authError = await requireDeletePermission()
  if (authError) return { error: authError }

  if (!Array.isArray(ids)) return { error: '잘못된 삭제 요청입니다.' }

  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (!uniqueIds.length) return { error: null }
  if (uniqueIds.length > 300) {
    return { error: '한 번에 삭제할 수 있는 설치건은 최대 300건입니다.' }
  }

  const admin = createAdminClient()
  const { data: targets, error: lookupError } = await admin
    .from('installations')
    .select('id, franchise_application_id')
    .in('id', uniqueIds)

  if (lookupError) return { error: lookupError.message }
  if ((targets?.length ?? 0) !== uniqueIds.length) {
    return { error: '삭제할 설치건을 찾을 수 없습니다. 목록을 새로고침해 주세요.' }
  }

  const linkedTargets = targets?.filter(target => target.franchise_application_id) ?? []
  if (linkedTargets.length > 0) {
    return { error: '가맹접수에서 이관된 설치건은 삭제할 수 없습니다.' }
  }

  const { data: deleted, error: deleteError } = await admin
    .from('installations')
    .delete()
    .in('id', uniqueIds)
    .is('franchise_application_id', null)
    .select('id')

  if (deleteError) return { error: deleteError.message }
  if ((deleted?.length ?? 0) !== uniqueIds.length) {
    return { error: '일부 설치건이 가맹접수와 연결되어 삭제되지 않았습니다. 목록을 새로고침해 주세요.' }
  }

  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null }
}
