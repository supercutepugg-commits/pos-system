'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export default function MarkAllRead({ userId }: { userId: string }) {
  const router = useRouter()
  const toast = useToast()

  async function handleMarkAll() {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    if (error) { toast.error('읽음 처리 실패: ' + error.message); return }
    router.refresh()
  }

  async function handleDeleteAll() {
    if (!confirm('알림을 전체 삭제하시겠습니까?')) return
    const supabase = createClient()
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) { toast.error('전체 삭제 실패: ' + error.message); return }
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
