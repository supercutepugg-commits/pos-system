import { NextRequest, NextResponse } from 'next/server'
import { sendFranchiseDocRequest, sendFranchiseStatusUpdate } from '@/lib/solapi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, ownerName, businessName, applicantType, status, docCase } = body
    const phone = (body.phone ?? '').replace(/\D/g, '')

    if (type === 'doc_request') {
      await sendFranchiseDocRequest({ phone, ownerName, businessName, applicantType, docCase })
    } else if (type === 'status_update') {
      await sendFranchiseStatusUpdate({ phone, ownerName, businessName, status })
    } else {
      return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const failed = e?.failedMessageList
      ?? e?.response?.data?.failedMessageList
      ?? e?.data?.failedMessageList
    console.error('[franchise/notify] raw error keys:', Object.getOwnPropertyNames(e))
    console.error('[franchise/notify] failedMessageList:', JSON.stringify(failed))
    if (failed?.length) {
      const firstErr = failed[0]
      const detail = firstErr?.resultMessage ?? firstErr?.reason ?? firstErr?.statusMessage ?? JSON.stringify(firstErr)
      return NextResponse.json({ ok: false, error: detail }, { status: 500 })
    }
    const detail = e?.message ?? String(e)
    console.error('[franchise/notify] error:', detail)
    return NextResponse.json({ ok: false, error: detail }, { status: 500 })
  }
}
