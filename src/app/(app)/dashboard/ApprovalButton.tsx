'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { approveFranchiseTransfer, approveInstallationCompletion } from './actions'

export default function ApprovalButton({ type, id }: { type: 'completion' | 'transfer'; id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function approve() {
    startTransition(async () => {
      const result = type === 'completion'
        ? await approveInstallationCompletion(id)
        : await approveFranchiseTransfer(id)
      if (result.error) {
        toast.error(`승인 실패: ${result.error}`)
        return
      }
      toast.success(type === 'completion' ? '설치완료 승인 처리되었습니다.' : '승인되어 기술지원으로 이관되었습니다.')
      router.refresh()
    })
  }

  return (
    <button type="button" onClick={approve} disabled={isPending} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
      <Check size={14} /> {isPending ? '처리 중' : '승인'}
    </button>
  )
}
