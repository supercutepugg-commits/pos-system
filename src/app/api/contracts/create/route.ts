import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const signerName = formData.get('signerName') as string
    const signerEmail = formData.get('signerEmail') as string
    const signerPhone = formData.get('signerPhone') as string
    const createdBy = user.id

    
    const ext = file.name.split('.').pop() ?? 'pdf'
    const fileName = `${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(fileName, arrayBuffer, { contentType: 'application/pdf' })

    if (uploadError) {
      return NextResponse.json({ error: 'PDF 업로드 실패: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(fileName)

    
    const { data, error } = await supabase.from('contracts').insert({
      title,
      pdf_url: publicUrl,
      signer_name: signerName,
      signer_email: signerEmail || null,
      signer_phone: signerPhone || null,
      created_by: createdBy,
      status: 'pending',
    }).select('id, sign_token').single()

    if (error) {
      return NextResponse.json({ error: '등록 실패: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id, sign_token: data.sign_token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
