'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ArrowRight, Search } from 'lucide-react'
import { FRANCHISE_STATUS_LABEL, type FranchiseStatus } from '@/types'

interface Log {
  id: string
  from_status: string | null
  to_status: string | null
  created_at: string
  user: { name: string } | null
  franchise_application: { id: string; business_name: string; owner_name: string } | null
}

export default function LogsClient({ logs }: { logs: Log[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(l =>
      (l.user?.name ?? '').toLowerCase().includes(q) ||
      (l.franchise_application?.business_name ?? '').toLowerCase().includes(q) ||
      (l.franchise_application?.owner_name ?? '').toLowerCase().includes(q)
    )
  }, [query, logs])

  function label(status: string | null) {
    if (!status) return '-'
    return FRANCHISE_STATUS_LABEL[status as FranchiseStatus] ?? status
  }

  return (
    <>
      <div className="mb-4 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="담당자 또는 상호명으로 검색"
          className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {filtered.map(log => (
            <div key={log.id} className="px-5 py-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-wrap">
                <span className="font-semibold text-slate-900">{log.user?.name ?? '알 수 없음'}</span>
                <span className="text-slate-400">·</span>
                <span>{log.franchise_application?.business_name || log.franchise_application?.owner_name || '삭제된 가맹접수'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 flex-wrap">
                <span>{label(log.from_status)}</span>
                <ArrowRight size={11} />
                <span className="font-medium text-slate-700">{label(log.to_status)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">로그가 없습니다.</p>
          )}
        </div>
      </div>
    </>
  )
}
