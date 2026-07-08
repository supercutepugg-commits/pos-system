import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = typeof body.token === 'string' ? body.token : ''
    const equipment = Array.isArray(body.equipment) ? body.equipment.filter((v: unknown) => typeof v === 'string') : []
    if (!token || !equipment.length) {
      return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 })
    }

    // 고객은 로그인하지 않은 상태로 접근하므로 admin 클라이언트 사용
    // (equipment_select_token 자체가 보안 경계)
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('franchise_applications')
      .update({ selected_equipment: equipment, equipment_selected_at: new Date().toISOString() })
      .eq('equipment_select_token', token)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
