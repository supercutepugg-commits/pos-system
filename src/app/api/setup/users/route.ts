import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USERS = [
  { name: '최혜민', email: 'choi.hyemin@pos.kr', role: 'cs' },
  { name: '서지은', email: 'seo.jieun@pos.kr', role: 'cs' },
  { name: '김명선', email: 'kim.myungsun@pos.kr', role: 'tech' },
  { name: '이명진', email: 'lee.myungjin@pos.kr', role: 'tech' },
  { name: '임경수', email: 'im.gyeongsu@pos.kr', role: 'tech' },
  { name: '박상준', email: 'park.sangjun@pos.kr', role: 'tech' },
  { name: '태효섭', email: 'tae.hyosub@pos.kr', role: 'tech' },
  { name: '테스트영업', email: 'test.sales@pos.kr', role: 'sales' },
]

export async function GET() {
  const authError = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 403 })
  }

  const results = []

  for (const u of USERS) {
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: '1234',
      email_confirm: true,
    })

    if (error) {
      results.push({ name: u.name, status: 'error', message: error.message })
      continue
    }

    
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: data.user.id,
      name: u.name,
      role: u.role,
    })

    if (profileError) {
      results.push({ name: u.name, status: 'profile_error', message: profileError.message })
    } else {
      results.push({ name: u.name, status: 'ok', email: u.email })
    }
  }

  return NextResponse.json({ results })
}
