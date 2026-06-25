import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import SignClient from './SignClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: Props) {
  const { token } = await params
  // 고객은 로그인하지 않은 상태로 접근하므로 RLS를 우회하는 admin 클라이언트 사용
  // (sign_token 자체가 보안 경계이며, 아래 만료/서명완료 체크가 실질적인 접근 제어)
  const supabase = createAdminClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, pdf_url, signer_name, signer_phone, status, sign_token, token_expires_at, signature_zones')
    .eq('sign_token', token)
    .single()

  if (!contract) notFound()
  if (contract.status === 'signed') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <p className="text-2xl font-bold text-green-600 mb-2">이미 서명 완료된 계약서입니다</p>
        <p className="text-slate-500 text-sm">중복 서명은 불가합니다.</p>
      </div>
    </div>
  )
  if (new Date(contract.token_expires_at) < new Date()) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <p className="text-2xl font-bold text-red-500 mb-2">만료된 서명 링크입니다</p>
        <p className="text-slate-500 text-sm">담당자에게 새 링크를 요청해주세요.</p>
      </div>
    </div>
  )

  return <SignClient contract={contract} />
}
