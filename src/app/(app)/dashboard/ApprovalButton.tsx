'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { approveCsResponsibleTransfer, approveFranchiseTransfer } from './actions'
import { approveInstallationCompletion, approveInstallationStatusByTeamLead } from '../installs/actions'

export default function ApprovalButton({ type, id }: { type: 'completion' | 'tech_final' | 'cs_transfer' | 'transfer'; id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function approve() {
    startTransition(async () => {
      const result = type === 'completion'
        ? await approveInstallationCompletion(id)
        : type === 'tech_final'
          ? await approveInstallationStatusByTeamLead(id)
        : type === 'cs_transfer'
          ? await approveCsResponsibleTransfer(id)
          : await approveFranchiseTransfer(id)
      if (result.error) {
        toast.error(`승인 실패: ${result.error}`)
        return
      }
      if ('notificationError' in result && result.notificationError) {
        const notificationName = type === 'completion' ? '팀장 팝업 알림' : type === 'tech_final' ? '고객 알림톡' : type === 'cs_transfer' ? '팀장 팝업 알림' : '기술지원 내부 알림'
        toast.warning(`승인은 완료됐지만 ${notificationName} 발송에 실패했습니다: ${result.notificationError}`)
      }
      toast.success(type === 'completion' ? '기술지원책임 1차 승인 완료. 팀장 최종 승인을 기다립니다.' : type === 'tech_final' ? '팀장 최종 승인으로 상태가 반영되었습니다.' : type === 'cs_transfer' ? 'CS책임 승인 완료. 팀장 최종 승인을 기다립니다.' : '승인되어 기술지원으로 이관되었습니다.')
      router.refresh()
    })
  }

  return (
    <button type="button" onClick={approve} disabled={isPending} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
      <Check size={14} /> {isPending ? '처리 중' : '승인'}
    </button>
  )
}
