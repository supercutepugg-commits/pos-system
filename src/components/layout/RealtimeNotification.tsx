'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'

interface Props {
  userId: string
  initialCount: number
}

export default function RealtimeNotification({ userId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const [modal, setModal] = useState<{ title: string; body?: string } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function playSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx

      const times = [0, 0.15, 0.3]
      times.forEach((t) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime + t)
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + t + 0.1)
        gain.gain.setValueAtTime(0.3, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.15)
      })
    } catch {}
  }

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
          setModal({ title: payload.new.title, body: payload.new.body })
          playSound()
          router.refresh()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <>
      {/* 뱃지 */}
      {count > 0 && !modal && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {count > 9 ? '9+' : count}
        </span>
      )}

      {/* 가운데 모달 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />

          {/* 모달 박스 */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 헤더 */}
            <div className="bg-blue-600 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell size={18} className="text-white" />
              </div>
              <p className="text-white font-bold text-sm flex-1">새 알림</p>
              <button
                onClick={() => setModal(null)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 내용 */}
            <div className="px-5 py-5">
              <p className="text-slate-900 font-bold text-base mb-1">{modal.title}</p>
              {modal.body && <p className="text-slate-500 text-sm">{modal.body}</p>}
            </div>

            {/* 확인 버튼 */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setModal(null)}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
