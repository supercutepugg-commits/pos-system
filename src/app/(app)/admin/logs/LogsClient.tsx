'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ArrowRight, Search, X } from 'lucide-react'
import { FRANCHISE_STATUS_LABEL, type FranchiseStatus } from '@/types'

interface Log {
  id: string
  from_status: string | null
  to_status: string | null
  created_at: string
  user_name: string | null
  user: { name: string } | null
  franchise_application: { id: string; business_name: string; owner_name: string } | null
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

export default function LogsClient({ logs, selectedDate }: { logs: Log[]; selectedDate: string | null }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function goToDate(date: string) {
    router.push(`/admin/logs?date=${date}`)
  }

  function clearDate() {
    router.push('/admin/logs')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(l =>
      (l.user?.name ?? '').toLowerCase().includes(q) ||
      (l.franchise_application?.business_name ?? '').toLowerCase().includes(q) ||
      (l.franchise_application?.owner_name ?? '').toLowerCase().includes(q)
    )
  }, [query, logs])

  const userCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of logs) {
      const name = l.user?.name ?? '알 수 없음'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [logs])

  function label(status: string | null) {
    if (!status) return '-'
    return FRANCHISE_STATUS_LABEL[status as FranchiseStatus] ?? status
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={selectedDate ?? ''}
          onChange={e => e.target.value && goToDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => goToDate(todayStr())}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
        >
          오늘
        </button>
        {selectedDate && (
          <button
            onClick={clearDate}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1"
          >
            <X size={13} />
            초기화
          </button>
        )}
      </div>

      {userCounts.length > 0 && (
        <div className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            {selectedDate ? `${selectedDate} 담당자별 처리 건수` : '담당자별 처리 건수'}
          </p>
          <div className="flex flex-wrap gap-2">
            {userCounts.map(([name, count]) => (
              <span
                key={name}
                className="text-xs font-medium bg-slate-100 text-slate-700 rounded-full px-3 py-1"
              >
                {name} <span className="text-blue-600 font-semibold">{count}건</span>
              </span>
            ))}
          </div>
        </div>
      )}

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
                <span className="font-semibold text-slate-900">{log.user_name ?? log.user?.name ?? '알 수 없음'}</span>
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
