'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Hash } from 'lucide-react'
import type { SlackMessage } from '@/lib/slack'

const POLL_INTERVAL = 15000
const LAST_SEEN_KEY = 'slack_last_seen_ts'

export default function SlackPopupNotifier() {
  const [popups, setPopups] = useState<SlackMessage[]>([])
  const lastSeenRef = useRef<string | null>(null)
  const initializedRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    lastSeenRef.current = localStorage.getItem(LAST_SEEN_KEY)

    async function poll() {
      try {
        const res = await fetch('/api/slack/messages', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const messages: SlackMessage[] = data.messages ?? []
        if (messages.length === 0) return

        if (!initializedRef.current) {
          initializedRef.current = true
          if (!lastSeenRef.current) {
            lastSeenRef.current = messages[0].ts
            localStorage.setItem(LAST_SEEN_KEY, messages[0].ts)
          }
          return
        }

        const lastSeen = lastSeenRef.current
        const newMessages = lastSeen
          ? messages.filter(m => Number(m.ts) > Number(lastSeen)).reverse()
          : []

        if (newMessages.length > 0) {
          setPopups(prev => [...prev, ...newMessages])
          lastSeenRef.current = messages[0].ts
          localStorage.setItem(LAST_SEEN_KEY, messages[0].ts)
        }
      } catch {}
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  function closePopup(ts: string) {
    setPopups(prev => prev.filter(p => p.ts !== ts))
  }

  if (popups.length === 0) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" />
      <div className="relative flex flex-col gap-3 pointer-events-auto">
        {popups.map(p => (
          <div key={p.ts} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#3e6d9c] px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Hash size={18} className="text-white" />
              </div>
              <p className="text-white font-bold text-sm flex-1">Slack 새 메시지</p>
              <button onClick={() => closePopup(p.ts)} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-slate-900 font-bold text-base mb-1">{p.user}</p>
              <p className="text-slate-600 text-sm whitespace-pre-wrap break-words">{p.text}</p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => { closePopup(p.ts); router.push('/slack') }}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                Slack으로 이동
              </button>
              <button
                onClick={() => closePopup(p.ts)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
