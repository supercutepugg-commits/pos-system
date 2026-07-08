import { NextRequest, NextResponse } from 'next/server'
import { sendInstallStatusUpdate } from '@/lib/solapi'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
    const { customerName, status, eta, statusToken, scheduledDate, scheduledTime, trackingNumber } = body
    if (!phone || !customerName || !status) {
      return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
    }
    await sendInstallStatusUpdate({ phone, customerName, status, eta, statusToken, scheduledDate, scheduledTime, trackingNumber })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('install notify error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
