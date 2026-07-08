'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Hash, RefreshCw } from 'lucide-react'
import type { SlackMessage } from '@/lib/slack'

interface Props {
  initialMessages: SlackMessage[]
  initialError: string | null
}

export default function SlackMessagesClient({ initialMessages, initialError }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/slack/messages', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '메시지를 불러오지 못했습니다')
      setMessages(data.messages)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-[#3e6d9c] px-5 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <Hash size={18} />
          Slack 메시지
        </h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-white/80 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-5 py-3 border-b border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white divide-y divide-slate-100">
        {messages.length === 0 && !error && (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">메시지가 없습니다</p>
        )}
        {messages.map(m => (
          <div key={m.ts} className="px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{m.user}</p>
              <p className="text-xs text-slate-400 flex-shrink-0">
                {format(new Date(Number(m.ts) * 1000), 'MM/dd HH:mm', { locale: ko })}
              </p>
            </div>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">{m.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
