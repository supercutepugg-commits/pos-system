import { NextRequest, NextResponse } from 'next/server'
import { sendFranchiseDocRequest, sendFranchiseStatusUpdate } from '@/lib/solapi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, phone, ownerName, businessName, applicantType, status, docCase } = body

    if (type === 'doc_request') {
      await sendFranchiseDocRequest({ phone, ownerName, businessName, applicantType, docCase })
    } else if (type === 'status_update') {
      await sendFranchiseStatusUpdate({ phone, ownerName, businessName, status })
    } else {
      return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('franchise notify error:', JSON.stringify(e?.response?.data ?? e?.message ?? e))
    return NextResponse.json({ ok: false, error: e?.response?.data?.message ?? e.message }, { status: 500 })
  }
}
