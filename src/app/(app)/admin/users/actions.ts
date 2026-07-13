'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requireMaster } from '@/lib/auth/require-admin'

const ROLES = ['master', 'admin', 'sales', 'cs', 'tech']

export async function createUserAccount(form: { name: string; phone: string; password: string; role: string }) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }

  const name = form.name.trim()
  const password = form.password.trim()
  const phone = form.phone.trim()
  const role = form.role

  if (!name) return { error: '이름을 입력해주세요.' }
  if (password.length < 4) return { error: '비밀번호는 4자 이상이어야 합니다.' }
  if (!ROLES.includes(role)) return { error: '올바르지 않은 역할입니다.' }

  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('profiles').select('id').eq('name', name).maybeSingle()
  if (existing) return { error: `이미 "${name}" 이름으로 등록된 계정이 있습니다.` }

  const email = `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@pos.local`

  const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authCreateError || !authData.user) {
    return { error: '계정 생성 실패: ' + (authCreateError?.message ?? '알 수 없는 오류') }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    name,
    phone: phone || null,
    role,
  })
  if (profileError) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(authData.user.id)
    if (cleanupError) {
      console.error('프로필 생성 실패 후 인증 계정 정리 실패:', cleanupError.message, 'userId:', authData.user.id)
      return {
        error: '프로필 생성 실패: ' + profileError.message +
          ` (또한 인증 계정 정리 실패: ${cleanupError.message} — 관리자에게 문의하세요. userId: ${authData.user.id})`,
      }
    }
    return { error: '프로필 생성 실패: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { error: null }
}

export async function deleteUserAccount(userId: string) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }

  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (user?.id === userId) return { error: '본인 계정은 삭제할 수 없습니다.' }

  const supabase = createAdminClient()



  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)
  if (authDeleteError) return { error: '계정 삭제 실패(인증): ' + authDeleteError.message }

  const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId)
  if (profileError) return { error: '계정 삭제 실패(프로필): ' + profileError.message }

  revalidatePath('/admin/users')
  return { error: null }
}

export async function setUserRole(userId: string, role: string) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }

  if (!ROLES.includes(role)) return { error: '올바르지 않은 역할입니다.' }

  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (user?.id === userId) return { error: '본인 역할은 변경할 수 없습니다.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { error: null }
}

export async function setUserName(userId: string, name: string) {
  const authError = await requireMaster()
  if (authError) return { error: authError }

  const trimmed = name.trim()
  if (!trimmed) return { error: '이름을 입력해주세요.' }

  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('profiles').select('id').eq('name', trimmed).neq('id', userId).maybeSingle()
  if (existing) return { error: `이미 "${trimmed}" 이름으로 등록된 계정이 있습니다.` }

  const { error } = await supabase.from('profiles').update({ name: trimmed }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { error: null }
}

export async function setUserDeletePermission(userId: string, canDelete: boolean) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await supabase.from('profiles').update({ can_delete: canDelete }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { error: null }
}
