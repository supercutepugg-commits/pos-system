import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import InstallStatusClient from './InstallStatusClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InstallStatusPage({ params }: Props) {
  const { token } = await params
  // 고객은 로그인하지 않은 상태로 접근하므로 RLS를 우회하는 admin 클라이언트 사용
  // (status_token 자체가 보안 경계)
  const supabase = createAdminClient()

  const { data: install } = await supabase
    .from('installations')
    .select('id, customer_name, status, status_token, requested_date, requested_time_slot, schedule_request_note, schedule_request_at')
    .eq('status_token', token)
    .single()

  if (!install) notFound()

  if (['completed', 'rejected'].includes(install.status)) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <p className="text-2xl font-bold text-slate-700 mb-2">
          {install.status === 'completed' ? '설치가 이미 완료되었습니다' : '진행이 취소된 건입니다'}
        </p>
        <p className="text-slate-500 text-sm">변경이 필요하시면 담당자에게 연락해주세요.</p>
      </div>
    </div>
  )

  return <InstallStatusClient install={install} />
}
