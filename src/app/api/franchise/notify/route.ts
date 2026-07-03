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
    // Solapi MessageNotReceivedError has failedMessageList
    const failed = e?.failedMessageList ?? e?.response?.data?.failedMessageList
    if (failed) {
      console.error('[franchise/notify] failedMessageList:', JSON.stringify(failed))
      const firstErr = failed[0]
      const detail = firstErr?.resultMessage ?? firstErr?.reason ?? JSON.stringify(firstErr)
      return NextResponse.json({ ok: false, error: detail }, { status: 500 })
    }
    const detail = e?.response?.data ?? e?.message ?? String(e)
    console.error('[franchise/notify] error:', JSON.stringify(detail))
    return NextResponse.json({ ok: false, error: JSON.stringify(detail) }, { status: 500 })
  }
}
