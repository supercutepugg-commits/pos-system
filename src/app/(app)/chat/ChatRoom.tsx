'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Send } from 'lucide-react'
import type { Profile } from '@/types'
import { useToast } from '@/components/ui/Toast'

const ROLE_LABEL: Record<string, string> = { admin: '관리자', sales: '영업', cs: 'CS', tech: '기술지원' }
const ROLE_COLOR: Record<string, string> = {
  admin: 'text-purple-600',
  sales: 'text-blue-600',
  cs: 'text-emerald-600',
  tech: 'text-orange-600',
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  user: { id: string; name: string; role: string } | null
}

interface Props {
  profile: Profile
  initialMessages: Message[]
}

export default function ChatRoom({ profile, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const { data: msg, error } = await supabase
            .from('messages')
            .select('*, user:profiles(id, name, role)')
            .eq('id', payload.new.id)
            .single()
          if (error) {
            console.error('메시지 조회 실패:', error)
            toast.error('새 메시지를 불러오지 못했습니다')
            return
          }
          if (msg) setMessages(prev => [...prev, msg as Message])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)

    const content = input.trim()
    const { error } = await supabase.from('messages').insert({
      user_id: profile.id,
      content,
    })

    if (error) {
      console.error('메시지 전송 실패:', error)
      toast.error('메시지 전송에 실패했습니다. 다시 시도해주세요.')
      setSending(false)
      return
    }

    setInput('')
    setSending(false)
  }

  function groupMessages(msgs: Message[]) {
    return msgs.map((msg, i) => {
      const prev = msgs[i - 1]
      const showProfile = !prev || prev.user_id !== msg.user_id ||
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000
      const showDate = !prev ||
        format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(prev.created_at), 'yyyy-MM-dd')
      return { ...msg, showProfile, showDate }
    })
  }

  const grouped = groupMessages(messages)
  const isMe = (msg: Message) => msg.user_id === profile.id

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#b2c7d9]">
      {}
      <div className="bg-[#3e6d9c] px-5 py-4 flex items-center gap-3 shadow-sm flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
          전체
        </div>
        <div>
          <p className="text-white font-bold text-base">전체 채팅방</p>
          <p className="text-white/70 text-xs">POS 전산 시스템</p>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {grouped.map(msg => (
          <div key={msg.id}>
            {}
            {msg.showDate && (
              <div className="flex items-center justify-center my-4">
                <span className="bg-black/20 text-white text-xs px-3 py-1 rounded-full">
                  {format(new Date(msg.created_at), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </span>
              </div>
            )}

            <div className={`flex items-end gap-2 ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
              {}
              {!isMe(msg) && (
                <div className="flex-shrink-0 w-9 self-start mt-1">
                  {msg.showProfile ? (
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sm font-bold text-slate-700 shadow-sm">
                      {msg.user?.name?.[0] ?? '?'}
                    </div>
                  ) : <div className="w-9" />}
                </div>
              )}

              <div className={`flex flex-col max-w-[70%] ${isMe(msg) ? 'items-end' : 'items-start'}`}>
                {}
                {!isMe(msg) && msg.showProfile && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <span className="text-sm font-bold text-slate-800">{msg.user?.name}</span>
                    <span className={`text-xs font-medium ${ROLE_COLOR[msg.user?.role ?? 'sales']}`}>
                      {ROLE_LABEL[msg.user?.role ?? 'sales']}
                    </span>
                  </div>
                )}

                <div className={`flex items-end gap-1.5 ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
                  {}
                  <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed break-words ${
                    isMe(msg)
                      ? 'bg-[#fee500] text-slate-900 rounded-tr-sm'
                      : 'bg-white text-slate-900 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  {}
                  <span className="text-[10px] text-white/70 whitespace-nowrap mb-0.5">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {}
      <form onSubmit={sendMessage} className="bg-white border-t border-slate-200 px-3 py-3 flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 bg-[#fee500] rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0 shadow-sm"
        >
          <Send size={17} className="text-slate-800" />
        </button>
      </form>
    </div>
  )
}
