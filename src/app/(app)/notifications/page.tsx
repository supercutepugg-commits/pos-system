import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Link from 'next/link'
import MarkAllRead from './MarkAllRead'

export default async function NotificationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">알림</h1>
        <MarkAllRead userId={user.id} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {notifications?.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">알림이 없습니다</p>
        )}
        {notifications?.map(n => (
          <Link
            key={n.id}
            href={n.ticket_id ? `/tickets/${n.ticket_id}` : '/notifications'}
            className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
            <div className="flex-1">
              <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(n.created_at), 'M월 d일 HH:mm', { locale: ko })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
