import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SignClient from './SignClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, pdf_url, signer_name, signer_phone, status, sign_token, token_expires_at, signature_zones')
    .eq('sign_token', token)
    .single()

  if (!contract) notFound()

  return <SignClient contract={contract} />
}
