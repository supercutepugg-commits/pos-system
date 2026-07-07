'use client'

import { useState, useTransition } from 'react'
import { setUserDeletePermission } from './actions'
import { useToast } from '@/components/ui/Toast'

interface Props {
  userId: string
  initialCanDelete: boolean
}

export default function DeletePermissionToggle({ userId, initialCanDelete }: Props) {
  const [canDelete, setCanDelete] = useState(initialCanDelete)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  function handleToggle() {
    const next = !canDelete
    setCanDelete(next)
    startTransition(async () => {
      const { error } = await setUserDeletePermission(userId, next)
      if (error) { toast.error('권한 변경 실패: ' + error); setCanDelete(!next) }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title="가맹접수/입고관리/가맹점/인터넷관리/AS티켓/우체국관리 탭에서 삭제 권한"
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
        canDelete
          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
      }`}
    >
      삭제 권한 {canDelete ? 'ON' : 'OFF'}
    </button>
  )
}
