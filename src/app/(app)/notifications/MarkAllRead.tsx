'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MarkAllRead({ userId }: { userId: string }) {
  const router = useRouter()

  async function handleClick() {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    router.refresh()
  }

  return (
    <button onClick={handleClick} className="text-sm text-blue-600 hover:underline">
      모두 읽음
    </button>
  )
}
