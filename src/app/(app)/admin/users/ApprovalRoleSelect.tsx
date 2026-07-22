'use client'

import { useState, useTransition } from 'react'
import { setUserApprovalRole } from './actions'
import { APPROVAL_ROLE_LABEL_KR } from './constants'
import { useToast } from '@/components/ui/Toast'

const APPROVAL_ROLES = ['cs_manager', 'cs_responsible', 'tech_manager', 'tech_responsible', 'team_lead', 'developer']

export default function ApprovalRoleSelect({ userId, initialRole }: { userId: string; initialRole: string | null }) {
  const [role, setRole] = useState(initialRole ?? '')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  return <select value={role} disabled={isPending} onChange={event => {
    const next = event.target.value
    const previous = role
    setRole(next)
    startTransition(async () => {
      if (!next) { setRole(previous); return }
      const { error } = await setUserApprovalRole(userId, next)
      if (error) { toast.error('승인 직책 변경 실패: ' + error); setRole(previous) }
    })
  }} className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-50">
    <option value="">승인 직책 미지정</option>
    {APPROVAL_ROLES.map(item => <option key={item} value={item}>{APPROVAL_ROLE_LABEL_KR[item]}</option>)}
  </select>
}
