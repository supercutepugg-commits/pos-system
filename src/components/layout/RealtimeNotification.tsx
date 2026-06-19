'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  initialCount: number
}

export default function RealtimeNotification({ userId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('notifications-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setCount(c => c + 1)
          setToast({ title: payload.new.title, body: payload.new.body })
          router.refresh()
          // 3초 후 토스트 숨김
          setTimeout(() => setToast(null), 3000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (!toast) return (
    count > 0 ? (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
        {count > 9 ? '9+' : count}
      </span>
    ) : null
  )

  return (
    <>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {count > 9 ? '9+' : count}
        </span>
      )}
      {/* 토스트 알림 */}
      <div className="fixed top-4 right-4 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3.5 max-w-xs animate-in slide-in-from-right">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-sm">🔔</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{toast.title}</p>
            {toast.body && <p className="text-xs text-slate-500 mt-0.5">{toast.body}</p>}
          </div>
        </div>
      </div>
    </>
  )
}
