import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { name, password } = await req.json()

  
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('name', name)
    .single()

  if (!profile) {
    return NextResponse.json({ error: '이름을 찾을 수 없습니다.' }, { status: 400 })
  }

  
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
  if (!userData.user?.email) {
    return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  return NextResponse.json({ email: userData.user.email })
}
