'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  id: string
  href: string
  title: string
  body?: string
  createdAtLabel: string
  isRead: boolean
}

export default function NotificationRow({ id, href, title, body, createdAtLabel, isRead }: Props) {
  const router = useRouter()

  async function handleClick() {
    if (!isRead) {
      const supabase = createClient()
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      // 읽음 처리가 실패해도 사용자의 이동을 막지는 않되, 로컬에서 성공했다고 가정하지 않는다
      // (router.refresh()로 서버 상태를 다시 가져와 실제 읽음 여부를 반영한다).
      if (error) console.error('알림 읽음 처리 실패:', error.message)
    }
    router.push(href)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left ${!isRead ? 'bg-blue-50/50' : ''}`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
      <div className="flex-1">
        <p className={`text-sm ${!isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{title}</p>
        {body && <p className="text-xs text-gray-500 mt-0.5">{body}</p>}
        <p className="text-xs text-gray-400 mt-1">{createdAtLabel}</p>
      </div>
    </button>
  )
}
