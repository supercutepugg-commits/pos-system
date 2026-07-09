import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { token, requestedDate, timeSlot, note } = await req.json()
    if (!token) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: install } = await supabase
      .from('installations')
      .select('id, customer_name, assigned_to, created_by, status')
      .eq('status_token', token)
      .single()

    if (!install) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })
    if (['completed', 'rejected'].includes(install.status)) {
      return NextResponse.json({ error: '이미 종료된 건입니다.' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('installations')
      .update({
        requested_date: requestedDate || null,
        requested_time_slot: timeSlot || null,
        schedule_request_note: note || null,
        schedule_request_at: new Date().toISOString(),
        schedule_request_seen: false,
      })
      .eq('id', install.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const notifyTargets = new Set<string>()
    if (install.assigned_to) notifyTargets.add(install.assigned_to)
    if (install.created_by) notifyTargets.add(install.created_by)
    if (notifyTargets.size === 0) {
      const { data: csProfiles } = await supabase.from('profiles').select('id').eq('role', 'cs')
      csProfiles?.forEach(u => notifyTargets.add(u.id))
    }
    for (const uid of notifyTargets) {
      await supabase.from('notifications').insert({
        user_id: uid,
        installation_id: install.id,
        type: 'schedule',
        title: `[${install.customer_name}] 설치 일정 요청`,
        body: requestedDate
          ? `날짜 변경 요청: ${requestedDate}${timeSlot ? ` / ${timeSlot}` : ''}${note ? ` — ${note}` : ''}`
          : `희망 시간대: ${timeSlot ?? '미지정'}${note ? ` — ${note}` : ''}`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
