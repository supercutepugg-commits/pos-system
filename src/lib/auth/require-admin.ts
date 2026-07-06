import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '로그인이 필요합니다.'

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return '권한이 없습니다.'

  return null
}

// 가맹접수(CS) 탭처럼 admin 외에 cs 역할도 허용해야 하는 삭제 등에 사용
export async function requireAdminOrCs(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '로그인이 필요합니다.'

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'cs')) return '권한이 없습니다.'

  return null
}
