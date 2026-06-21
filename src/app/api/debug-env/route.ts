import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  const supabase = createAdminClient()
  const { error: deleteError } = await supabase.from('tickets').delete().in('id', ['00000000-0000-0000-0000-000000000000'])
  const { error: selectError, count } = await supabase.from('tickets').select('id', { count: 'exact', head: true })

  return NextResponse.json({
    url,
    urlLen: url.length,
    anonPrefix: anon.slice(0, 6),
    anonLen: anon.length,
    servicePrefix: service.slice(0, 6),
    serviceLen: service.length,
    deleteError,
    selectError,
    count,
  })
}
