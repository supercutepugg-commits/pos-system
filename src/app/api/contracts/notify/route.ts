import { NextRequest, NextResponse } from 'next/server'
import { sendSignRequest, sendSignComplete } from '@/lib/solapi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, signerPhone, signerName, contractTitle, signToken } = body

    if (type === 'sign_request') {
      await sendSignRequest({ signerPhone, signerName, contractTitle, signToken })
    } else if (type === 'sign_complete') {
      await sendSignComplete({ signerPhone, signerName, contractTitle })
    } else {
      return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('notify error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
