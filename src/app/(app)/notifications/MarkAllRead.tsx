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

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleMarkAll} className="text-sm text-blue-600 hover:underline">
        모두 읽음
      </button>
    </div>
  )
}
