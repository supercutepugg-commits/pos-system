'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { approveCsResponsibleTransfer, approveFranchiseTransfer } from './actions'
import { approveInstallationCompletion, approveInstallationStatusByTeamLead } from '../installs/actions'
import { INSTALLATION_DELIVERY_TYPE_OPTIONS, type InstallationDeliveryType } from '@/lib/installationDeliveryType'

export default function ApprovalButton({ type, id }: { type: 'completion' | 'tech_final' | 'cs_transfer' | 'transfer'; id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()
  const [showDeliveryType, setShowDeliveryType] = useState(false)
  const [deliveryType, setDeliveryType] = useState<InstallationDeliveryType | ''>('')

  function approve(selectedDeliveryType?: InstallationDeliveryType) {
    if (type === 'transfer' && !selectedDeliveryType) {
      setDeliveryType('')
      setShowDeliveryType(true)
      return
    }
    startTransition(async () => {
      const result = type === 'completion'
        ? await approveInstallationCompletion(id)
        : type === 'tech_final'
          ? await approveInstallationStatusByTeamLead(id)
        : type === 'cs_transfer'
          ? await approveCsResponsibleTransfer(id)
          : await approveFranchiseTransfer(id, selectedDeliveryType as InstallationDeliveryType)
      if (result.error) {
        toast.error(`승인 실패: ${result.error}`)
        return
      }
      if ('notificationError' in result && result.notificationError) {
        const notificationName = type === 'completion' ? '팀장 팝업 알림' : type === 'tech_final' ? '고객 알림톡' : type === 'cs_transfer' ? '팀장 팝업 알림' : '기술지원 내부 알림'
        toast.warning(`승인은 완료됐지만 ${notificationName} 발송에 실패했습니다: ${result.notificationError}`)
      }
      toast.success(type === 'completion' ? '기술지원책임 1차 승인 완료. 팀장 최종 승인을 기다립니다.' : type === 'tech_final' ? '팀장 최종 승인으로 상태가 반영되었습니다.' : type === 'cs_transfer' ? 'CS책임 승인 완료. 팀장 최종 승인을 기다립니다.' : '승인되어 기술지원으로 이관되었습니다.')
      setShowDeliveryType(false)
      router.refresh()
    })
  }

  return <>
    <button type="button" onClick={() => approve()} disabled={isPending} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
      <Check size={14} /> {isPending ? '처리 중' : '승인'}
    </button>
    {showDeliveryType && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !isPending && setShowDeliveryType(false)}>
        <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
          <h2 className="text-lg font-bold text-slate-900">기술지원 이관 구분 선택</h2>
          <p className="mt-1 text-sm text-slate-500">팀장 최종 승인과 함께 적용할 구분을 선택해주세요.</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">이관 구분 <span className="text-red-500">*</span></label>
          <select value={deliveryType} onChange={event => setDeliveryType(event.target.value as InstallationDeliveryType | '')} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option value="">구분을 선택해주세요</option>
            {INSTALLATION_DELIVERY_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowDeliveryType(false)} disabled={isPending} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50">취소</button>
            <button type="button" onClick={() => deliveryType && approve(deliveryType)} disabled={!deliveryType || isPending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{isPending ? '승인 중...' : '최종 승인'}</button>
          </div>
        </section>
      </div>
    )}
  </>
}
