'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteUserAccount } from './actions'
import { useToast } from '@/components/ui/Toast'

interface Props {
  userId: string
  userName: string
}

export default function DeleteUserButton({ userId, userName }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      const { error } = await deleteUserAccount(userId)
      if (error) { toast.error(error); setConfirming(false) }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-red-600 font-medium">{userName}님 삭제할까요?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >{isPending ? '삭제 중...' : '확인'}</button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-xs px-2.5 py-1 rounded-full text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >취소</button>
      </div>
    )
  }

  return (
    <button
      onClick={handleDelete}
      title="계정 삭제"
      className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
    >
      <Trash2 size={15} />
    </button>
  )
}
