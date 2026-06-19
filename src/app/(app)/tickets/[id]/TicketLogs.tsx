'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { STATUS_LABEL, type TicketStatus } from '@/types'
import { ArrowRight } from 'lucide-react'

interface Log {
  id: string
  from_status?: string
  to_status?: string
  message?: string
  created_at: string
  user?: { name: string }
}

export default function TicketLogs({ logs }: { logs: Log[] }) {
  if (logs.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">작업 이력</h2>
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
            <div className="flex-1">
              {log.from_status && log.to_status && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 flex-wrap">
                  <span>{STATUS_LABEL[log.from_status as TicketStatus] ?? log.from_status}</span>
                  <ArrowRight size={11} />
                  <span className="font-medium">{STATUS_LABEL[log.to_status as TicketStatus] ?? log.to_status}</span>
                </div>
              )}
              {log.message && (
                <p className="text-xs text-gray-700 mt-0.5">{log.message}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {log.user?.name} · {format(new Date(log.created_at), 'M/d HH:mm', { locale: ko })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
