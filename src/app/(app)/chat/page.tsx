import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, Users } from 'lucide-react'
import type { Profile } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const ROLE_LABEL: Record<string, string> = { admin: '관리자', sales: '영업', cs: 'CS', tech: '기술지원' }
const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sales: 'bg-blue-100 text-blue-700',
  cs: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-orange-100 text-orange-700',
}


const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000000'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function ChatListPage({ searchParams }: Props) {
  const { error: errorParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: users },
    { data: dmRooms },
    { data: lastGlobalMsg },
    { data: reads },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    
    supabase.from('profiles').select('*').neq('id', user.id).order('name'),
    
    supabase
      .from('dm_rooms')
      .select('*, user1:profiles!dm_rooms_user1_id_fkey(id,name,role), user2:profiles!dm_rooms_user2_id_fkey(id,name,role)')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    
    supabase.from('messages').select('content, created_at').order('created_at', { ascending: false }).limit(1).single(),
    
    supabase.from('chat_room_reads').select('room_type, room_id, last_read_at').eq('user_id', user.id),
  ])

  if (!profile) redirect('/login')

  
  const roomIds = dmRooms?.map(r => r.id) ?? []
  const { data: dmLastMessages } = roomIds.length
    ? await supabase
        .from('dm_messages')
        .select('room_id, created_at')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
    : { data: [] as { room_id: string; created_at: string }[] }

  const lastMsgByRoom = new Map<string, string>()
  for (const m of dmLastMessages ?? []) {
    if (!lastMsgByRoom.has(m.room_id)) lastMsgByRoom.set(m.room_id, m.created_at)
  }

  const readsMap = new Map<string, string>()
  for (const r of reads ?? []) readsMap.set(`${r.room_type}:${r.room_id}`, r.last_read_at)

  const globalLastRead = readsMap.get(`global:${GLOBAL_ROOM_ID}`)
  const globalUnread = !!lastGlobalMsg && (!globalLastRead || new Date(lastGlobalMsg.created_at) > new Date(globalLastRead))

  const errorMessage = errorParam === 'dm_room_create_failed'
    ? '대화방을 생성하지 못했습니다. 다시 시도해주세요.'
    : null

  return (
    <div className="max-w-lg mx-auto">
      {}
      <div className="bg-[#3e6d9c] px-5 py-4">
        <h1 className="text-white font-bold text-lg">채팅</h1>
      </div>

      {errorMessage && (
        <div className="bg-red-50 text-red-700 text-sm px-5 py-3 border-b border-red-100">
          {errorMessage}
        </div>
      )}

      <div className="bg-white divide-y divide-slate-100">
        {}
        <Link href="/chat/global" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="relative w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Users size={22} className="text-white" />
            {globalUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-slate-900 ${globalUnread ? 'font-extrabold' : 'font-bold'}`}>전체 채팅방</p>
            <p className="text-sm text-slate-500 truncate mt-0.5" title={lastGlobalMsg?.content ?? undefined}>
              {lastGlobalMsg?.content ?? '메시지가 없습니다'}
            </p>
          </div>
          {lastGlobalMsg && (
            <p className="text-xs text-slate-400 flex-shrink-0">
              {format(new Date(lastGlobalMsg.created_at), 'HH:mm', { locale: ko })}
            </p>
          )}
        </Link>

        {}
        {dmRooms?.map(room => {
          const other = (room.user1 as any).id === user.id ? room.user2 as any : room.user1 as any
          const lastMsgAt = lastMsgByRoom.get(room.id)
          const lastRead = readsMap.get(`dm:${room.id}`)
          const unread = !!lastMsgAt && (!lastRead || new Date(lastMsgAt) > new Date(lastRead))
          return (
            <Link key={room.id} href={`/chat/dm/${room.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="relative w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700 font-bold text-lg">
                {other.name[0]}
                {unread && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-slate-900 ${unread ? 'font-extrabold' : 'font-bold'}`}>{other.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[other.role]}`}>
                    {ROLE_LABEL[other.role]}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">대화하기</p>
              </div>
            </Link>
          )
        })}
      </div>

      {}
      <div className="mt-4 bg-white">
        <p className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
          직원 목록 — 탭하여 1:1 대화
        </p>
        <div className="divide-y divide-slate-50">
          {users?.map(u => (
            <Link key={u.id} href={`/chat/new?to=${u.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700 font-bold">
                {u.name[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>
                  {ROLE_LABEL[u.role]}
                </span>
              </div>
              <MessageCircle size={16} className="text-slate-300 ml-auto" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
