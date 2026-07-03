'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MarkAllRead({ userId }: { userId: string }) {
  const router = useRouter()

  async function handleMarkAll() {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    router.refresh()
  }

  async function handleDeleteAll() {
    if (!confirm('알림을 전체 삭제하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('user_id', userId)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleMarkAll} className="text-sm text-blue-600 hover:underline">
        모두 읽음
      </button>
      <button onClick={handleDeleteAll} className="text-sm text-red-500 hover:underline">
        전체 삭제
      </button>
    </div>
  )
}
