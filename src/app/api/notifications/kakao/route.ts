import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { ticketId, newStatus, targets } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ticket } = await supabase
    .from('tickets')
    .select('title, merchant:merchants(business_name, phone, address)')
    .eq('id', ticketId)
    .single()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', targets)

  if (!ticket || !users) return NextResponse.json({ ok: false })

  const merchant = ticket.merchant as any
  const statusMessages: Record<string, string> = {
    cs_pending: 'CS팀으로 이관되었습니다.',
    tech_pending: '기사 배정이 완료되었습니다.',
    scheduled: '방문 일정이 확정되었습니다.',
    in_progress: '작업이 시작되었습니다.',
    done: '작업이 완료되었습니다.',
  }

  const message = statusMessages[newStatus] ?? '작업 상태가 변경되었습니다.'

  // 카카오 알림톡 API 연동
  const KAKAO_API_KEY = process.env.KAKAO_API_KEY
  const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY

  if (!KAKAO_API_KEY || !KAKAO_SENDER_KEY) {
    return NextResponse.json({ ok: true, skipped: 'kakao not configured' })
  }

  for (const user of users) {
    if (!user.phone) continue

    const phone = user.phone.replace(/-/g, '')

    await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: KAKAO_API_KEY,
        userid: 'your_aligo_userid',
        senderkey: KAKAO_SENDER_KEY,
        tpl_code: 'TK_001',
        sender: '발신번호',
        receiver_1: phone,
        subject_1: '[POS 전산] 작업 알림',
        message_1: `[POS 전산 시스템]\n${user.name}님, ${message}\n\n가맹점: ${merchant?.business_name}\n작업: ${ticket.title}\n주소: ${merchant?.address}`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
