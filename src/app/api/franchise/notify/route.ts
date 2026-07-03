import { NextRequest, NextResponse } from 'next/server'
import { sendFranchiseDocRequest, sendFranchiseStatusUpdate } from '@/lib/solapi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, phone, ownerName, businessName, applicantType, status, docCase } = body

    console.log('[franchise/notify] body:', JSON.stringify({ type, phone: phone?.slice(0, 4) + '****', applicantType, status, docCase }))
    console.log('[franchise/notify] env check:', {
      hasApiKey: !!process.env.SOLAPI_API_KEY,
      hasApiSecret: !!process.env.SOLAPI_API_SECRET,
      hasPfId: !!process.env.SOLAPI_KAKAO_PFID,
      hasSender: !!process.env.SOLAPI_SENDER,
    })

    if (type === 'doc_request') {
      await sendFranchiseDocRequest({ phone, ownerName, businessName, applicantType, docCase })
    } else if (type === 'status_update') {
      await sendFranchiseStatusUpdate({ phone, ownerName, businessName, status })
    } else {
      return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const detail = e?.response?.data ?? e?.message ?? String(e)
    console.error('[franchise/notify] error:', JSON.stringify(detail))
    return NextResponse.json({ ok: false, error: JSON.stringify(detail) }, { status: 500 })
  }
}
