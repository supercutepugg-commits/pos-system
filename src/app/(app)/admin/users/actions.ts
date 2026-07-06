'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'

const ROLES = ['admin', 'sales', 'cs', 'tech']

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
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: '프로필 생성 실패: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { error: null }
}
