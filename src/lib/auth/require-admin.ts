import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '로그인이 필요합니다.'

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return '권한이 없습니다.'

  return null
}

export async function requireAdminOrCs(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '로그인이 필요합니다.'

  const { data: profile } = await supabase.from('profiles').select('role, can_delete').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'cs' && !profile.can_delete)) return '권한이 없습니다.'

  return null
}

export async function requireDeletePermission(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '로그인이 필요합니다.'

  const { data: profile } = await supabase.from('profiles').select('role, can_delete').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && !profile.can_delete)) return '권한이 없습니다.'

  return null
}
