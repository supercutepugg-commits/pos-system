import { NextRequest, NextResponse } from 'next/server'
import { sendInstallStatusUpdate } from '@/lib/solapi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const phone = (body.phone ?? '').replace(/\D/g, '')
    const { customerName, status } = body
    if (!phone || !customerName || !status) {
      return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
    }
    await sendInstallStatusUpdate({ phone, customerName, status })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('install notify error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
