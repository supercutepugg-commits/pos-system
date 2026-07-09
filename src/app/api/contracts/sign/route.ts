import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface SignedItemInput {
  id: string
  type: 'signature' | 'stamp'
  dataUrl: string
  x: number
  y: number
  width: number
  height: number
  pageNumber: number
}

export async function POST(req: NextRequest) {
  try {
    const { token, items } = await req.json() as { token: string; items: SignedItemInput[] }
    if (!token || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }
    const MAX_ITEMS = 20
    const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: '서명/도장 항목이 너무 많습니다.' }, { status: 400 })
    }
    if (items.some((item) => typeof item.dataUrl !== 'string' || item.dataUrl.length > MAX_DATA_URL_LENGTH)) {
      return NextResponse.json({ error: '이미지 크기가 너무 큽니다.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: contract } = await supabase
      .from('contracts')
      .select('id, status, token_expires_at')
      .eq('sign_token', token)
      .single()

    if (!contract) {
      return NextResponse.json({ error: '유효하지 않은 서명 링크입니다.' }, { status: 404 })
    }
    if (contract.status === 'signed') {
      return NextResponse.json({ error: '이미 서명 완료된 계약서입니다.' }, { status: 409 })
    }
    if (new Date(contract.token_expires_at) < new Date()) {
      return NextResponse.json({ error: '만료된 서명 링크입니다.' }, { status: 410 })
    }

    const signedItems = await Promise.all(items.map(async (item) => {
      const fileName = `signatures/${contract.id}/${item.id}.png`
      const base64 = item.dataUrl.split(',')[1] ?? ''
      const buffer = Buffer.from(base64, 'base64')
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, buffer, { contentType: 'image/png', upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(fileName)
      return { ...item, dataUrl: publicUrl }
    }))

    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_zones: signedItems,
      })
      .eq('id', contract.id)

    if (updateError) {
      return NextResponse.json({ error: '서명 저장 실패: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
