'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronRight, Trash2 } from 'lucide-react'
import { deleteTickets } from './actions'
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, type TicketStatus, type TicketType, type Priority } from '@/types'

interface Ticket {
  id: string
  title: string
  type: string
  status: string
  priority: string
  scheduled_at?: string
  created_at: string
  merchant?: { business_name: string; phone: string } | null
  tech?: { name: string } | null
}

export default function TicketsClient({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)

  const allChecked = tickets.length > 0 && selected.size === tickets.length

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(tickets.map(t => t.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDelete() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeleting(true)
    const { error } = await deleteTickets([...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error); return }
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 선택 시 상단 액션바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100">
          <span className="text-sm font-semibold text-blue-700">{selected.size}건 선택됨</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? '삭제 중...' : '선택 삭제'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            취소
          </button>
        </div>
      )}

      {tickets.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">작업이 없습니다</p>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {tickets.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-medium">전체 선택</span>
          </div>
        )}
        {tickets.map(ticket => (
          <div key={ticket.id} className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors group">
            <input
              type="checkbox"
              checked={selected.has(ticket.id)}
              onChange={() => toggleOne(ticket.id)}
              onClick={e => e.stopPropagation()}
              className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
            />
            <Link href={`/tickets/${ticket.id}`} className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
                    {STATUS_LABEL[ticket.status as TicketStatus]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PRIORITY_COLOR[ticket.priority as Priority]}`}>
                    {PRIORITY_LABEL[ticket.priority as Priority]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{TYPE_LABEL[ticket.type as TicketType]}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{ticket.title}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-medium">{ticket.merchant?.business_name}</span>
                  {ticket.scheduled_at && (
                    <span>📅 {format(new Date(ticket.scheduled_at), 'M/d HH:mm', { locale: ko })}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <p className="text-xs text-slate-400">{format(new Date(ticket.created_at), 'M/d', { locale: ko })}</p>
                  {ticket.tech?.name && (
                    <p className="text-xs text-slate-500 mt-1 font-medium">{ticket.tech.name}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
