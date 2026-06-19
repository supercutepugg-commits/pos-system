'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Ticket, Profile } from '@/types'
import { ArrowRight, UserCheck, Calendar, CheckCircle } from 'lucide-react'

interface Props {
  ticket: Ticket & { merchant: any; sales: any; cs: any; tech: any }
  profile: Profile
  techUsers: { id: string; name: string; phone?: string }[]
  csUsers: { id: string; name: string }[]
}

export default function TicketActions({ ticket, profile, techUsers, csUsers }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function updateStatus(newStatus: string, extra?: Record<string, unknown>) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('tickets').update({ status: newStatus, ...extra }).eq('id', ticket.id)
    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      user_id: user?.id,
      from_status: ticket.status,
      to_status: newStatus,
      message: message || null,
    })

    // 알림 생성
    const targets: string[] = []
    if (newStatus === 'cs_pending' && ticket.cs_id) targets.push(ticket.cs_id)
    if (newStatus === 'tech_pending' && ticket.tech_id) targets.push(ticket.tech_id)
    if (newStatus === 'done' && ticket.sales_id) targets.push(ticket.sales_id)
    if (newStatus === 'sales' && ticket.status === 'cs_pending' && ticket.sales_id) targets.push(ticket.sales_id)

    for (const uid of targets) {
      const isRejected = newStatus === 'sales' && ticket.status === 'cs_pending'
      await supabase.from('notifications').insert({
        user_id: uid,
        ticket_id: ticket.id,
        type: newStatus,
        title: isRejected
          ? `[${ticket.merchant?.business_name}] CS 이관 거부`
          : `[${ticket.merchant?.business_name}] 상태 변경`,
        body: isRejected
          ? `${ticket.title} - CS팀에서 반려됨${message ? ': ' + message : ''}`
          : `${ticket.title} → ${newStatus}`,
      })
    }

    // 카카오 알림톡 (API 라우트 통해)
    if (targets.length > 0) {
      fetch('/api/notifications/kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, newStatus, targets }),
      }).catch(() => {})
    }

    setMessage('')
    setLoading(false)
    router.refresh()
  }

  async function assignUser(field: 'cs_id' | 'tech_id', userId: string) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tickets').update({ [field]: userId }).eq('id', ticket.id)
    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      user_id: user?.id,
      message: `${field === 'cs_id' ? 'CS' : '기사'} 배정`,
    })
    setLoading(false)
    router.refresh()
  }

  async function setSchedule(datetime: string) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tickets').update({ scheduled_at: datetime, status: 'scheduled' }).eq('id', ticket.id)
    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      user_id: user?.id,
      from_status: ticket.status,
      to_status: 'scheduled',
      message: `일정 확정: ${datetime}`,
    })
    setLoading(false)
    router.refresh()
  }

  const { status, role } = { status: ticket.status, role: profile.role }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">작업 액션</h2>

      {/* 메시지 입력 */}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="이관 메모 (선택사항)"
        rows={2}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-wrap gap-2">
        {/* 영업 → CS 이관 */}
        {status === 'sales' && (role === 'sales' || role === 'admin') && (
          <>
            <select
              onChange={e => e.target.value && assignUser('cs_id', e.target.value)}
              defaultValue=""
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">CS 담당자 선택</option>
              {csUsers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => updateStatus('cs_pending')}
              disabled={loading || !ticket.cs_id}
              className="flex items-center gap-1.5 bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 font-medium"
            >
              <ArrowRight size={15} />
              CS팀으로 이관
            </button>
          </>
        )}

        {/* CS → 이관 거부 (영업으로 반려) */}
        {status === 'cs_pending' && (role === 'cs' || role === 'admin') && (
          <button
            onClick={() => updateStatus('sales')}
            disabled={loading}
            className="flex items-center gap-1.5 bg-red-100 text-red-600 border border-red-200 text-sm px-4 py-2 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 font-medium"
          >
            ↩ 이관 거부 (반려)
          </button>
        )}

        {/* CS → 기사 배정 */}
        {(status === 'cs_pending' || status === 'cs_progress') && (role === 'cs' || role === 'admin') && (
          <>
            <select
              onChange={e => e.target.value && assignUser('tech_id', e.target.value)}
              defaultValue=""
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">기사 선택</option>
              {techUsers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => updateStatus('tech_pending')}
              disabled={loading || !ticket.tech_id}
              className="flex items-center gap-1.5 bg-orange-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 font-medium"
            >
              <UserCheck size={15} />
              기사 배정 완료
            </button>
          </>
        )}

        {/* 일정 확정 */}
        {(status === 'cs_pending' || status === 'cs_progress' || status === 'tech_pending') && (role === 'cs' || role === 'admin') && (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              onChange={e => e.target.value && setSchedule(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={13} /> 일정</span>
          </div>
        )}

        {/* 작업 시작 */}
        {(status === 'scheduled' || status === 'tech_pending') && (role === 'tech' || role === 'admin') && (
          <button
            onClick={() => updateStatus('in_progress')}
            disabled={loading}
            className="flex items-center gap-1.5 bg-purple-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 font-medium"
          >
            <ArrowRight size={15} />
            작업 시작
          </button>
        )}

        {/* 완료 처리 */}
        {status === 'in_progress' && (role === 'tech' || role === 'admin') && (
          <button
            onClick={() => updateStatus('done')}
            disabled={loading}
            className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
          >
            <CheckCircle size={15} />
            완료 처리
          </button>
        )}

        {/* 취소 */}
        {status !== 'done' && status !== 'canceled' && (role === 'cs' || role === 'admin') && (
          <button
            onClick={() => updateStatus('canceled')}
            disabled={loading}
            className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium"
          >
            취소
          </button>
        )}
      </div>
    </div>
  )
}
