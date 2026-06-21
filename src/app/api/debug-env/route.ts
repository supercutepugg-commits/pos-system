import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return NextResponse.json({
    url,
    urlLen: url.length,
    anonPrefix: anon.slice(0, 6),
    anonLen: anon.length,
    servicePrefix: service.slice(0, 6),
    serviceLen: service.length,
  })
}
