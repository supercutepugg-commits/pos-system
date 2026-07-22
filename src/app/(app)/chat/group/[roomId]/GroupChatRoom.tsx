'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Send, Users } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Link from 'next/link'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface Message {
  id: string; content: string; created_at: string; user_id: string
  user: { id: string; name: string; role: string } | null
}

interface Props {
  profile: Profile
  room: { id: string; name: string; description: string | null }
  initialMessages: Message[]
}

export default function GroupChatRoom({ profile, room, initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const markAsRead = useCallback(async () => {
    const { error } = await supabase
      .from('chat_room_reads')
      .upsert(
        { user_id: profile.id, room_type: 'group', room_id: room.id, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,room_type,room_id' }
      )
    if (error) console.error('단체 채팅방 읽음 상태 기록 실패:', error)
  }, [profile.id, room.id, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const channel = supabase.channel(`group-chat-${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `room_id=eq.${room.id}` }, async payload => {
        const { data: message, error } = await supabase
          .from('group_chat_messages')
          .select('*, user:profiles(id, name, role)')
          .eq('id', payload.new.id)
          .single()
        if (error) {
          toast.error('새 메시지를 불러오지 못했습니다.')
          return
        }
        if (message) {
          setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous, message as Message])
          await markAsRead()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [markAsRead, room.id, supabase, toast])

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    const { error } = await supabase.from('group_chat_messages').insert({ room_id: room.id, user_id: profile.id, content })
    if (error) toast.error('메시지 전송에 실패했습니다. 다시 시도해주세요.')
    else setInput('')
    setSending(false)
  }

  const grouped = messages.map((message, index) => {
    const previous = messages[index - 1]
    return {
      ...message,
      showDate: !previous || format(new Date(message.created_at), 'yyyy-MM-dd') !== format(new Date(previous.created_at), 'yyyy-MM-dd'),
      showProfile: !previous || previous.user_id !== message.user_id || new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() > 300000,
    }
  })

  return <div className="flex h-screen flex-col bg-[#b2c7d9]">
    <div className="flex shrink-0 items-center gap-3 bg-[#3e6d9c] px-4 py-3.5">
      <Link href="/chat" className="text-white/80 hover:text-white"><ArrowLeft size={20} /></Link>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"><Users size={18} /></div>
      <div><p className="font-bold text-white">{room.name}</p><p className="text-xs text-white/60">{room.description}</p></div>
    </div>
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
      {grouped.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-white/80">
          팀원에게 첫 메시지를 보내보세요.
        </div>
      )}
      {grouped.map(message => {
        const isMe = message.user_id === profile.id
        return <div key={message.id}>
          {message.showDate && <div className="my-4 flex justify-center"><span className="rounded-full bg-black/20 px-3 py-1 text-xs text-white">{format(new Date(message.created_at), 'yyyy년 M월 d일 (EEE)', { locale: ko })}</span></div>}
          <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
            {!isMe && <div className="w-9 self-start">{message.showProfile && <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700">{message.user?.name?.[0] ?? '?'}</div>}</div>}
            <div className={`flex max-w-[70%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && message.showProfile && <span className="mb-1 ml-1 text-sm font-bold text-slate-800">{message.user?.name}</span>}
              <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}><div className={`break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${isMe ? 'rounded-tr-sm bg-[#fee500] text-slate-900' : 'rounded-tl-sm bg-white text-slate-900'}`}>{message.content}</div><span className="mb-0.5 whitespace-nowrap text-[10px] text-white/70">{format(new Date(message.created_at), 'HH:mm')}</span></div>
            </div>
          </div>
        </div>
      })}
      <div ref={bottomRef} />
    </div>
    <form onSubmit={sendMessage} className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
      <input value={input} maxLength={4000} onChange={event => setInput(event.target.value)} placeholder="메시지를 입력하세요" className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="submit" disabled={!input.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fee500] shadow-sm disabled:opacity-40"><Send size={17} className="text-slate-800" /></button>
    </form>
  </div>
}
