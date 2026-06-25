import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import MarkAllRead from './MarkAllRead'
import NotificationRow from './NotificationRow'

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
          <NotificationRow
            key={n.id}
            id={n.id}
            href={n.ticket_id ? `/tickets/${n.ticket_id}` : n.franchise_application_id ? '/franchise' : '/notifications'}
            title={n.title}
            body={n.body}
            createdAtLabel={format(new Date(n.created_at), 'M월 d일 HH:mm', { locale: ko })}
            isRead={n.is_read}
          />
        ))}
      </div>
    </div>
  )
}
