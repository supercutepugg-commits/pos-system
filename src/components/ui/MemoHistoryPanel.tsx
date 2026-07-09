'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import HistoryIcon from './HistoryIcon'
import { createClient } from '@/lib/supabase/client'

type NotificationLog = {
  id: string
  template_key: string
  status: string
  error: string | null
  created_at: string
  user: { name: string } | null
}

// 스탬프(`[이름 MM. DD. HH:mm]`)가 붙은 항목뿐 아니라, 스탬프 도입 전에 저장된 맨 텍스트도 하나의 항목으로 살려서 반환한다
export function parseMemoEntries(memo: string | undefined | null, fallbackAt: string): { at: string; user: string; text: string }[] {
  if (!memo?.trim()) return []
  const re = /\[(.+?) (\d{2})\. (\d{2})\. (\d{2}):(\d{2})\]/g
  const matches = [...memo.matchAll(re)]
  if (matches.length === 0) {
    return [{ at: fallbackAt, user: '-', text: memo.trim() }]
  }
  const entries: { at: string; user: string; text: string }[] = []
  const leading = memo.slice(0, matches[0].index).trim()
  if (leading) entries.push({ at: fallbackAt, user: '-', text: leading })
  matches.forEach((m, i) => {
    const [, user, month, day, hour, minute] = m
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : memo.length
    const text = memo.slice(start, end).trim()
    if (!text) return
    const now = new Date()
    const at = new Date(now.getFullYear(), Number(month) - 1, Number(day), Number(hour), Number(minute)).toISOString()
    entries.push({ at, user, text })
  })
  return entries
}

interface Props {
  title: string
  memo: string | undefined | null
  createdAt: string
  onAddMemo: (value: string) => void
  onClose: () => void
  entityType?: string
  entityId?: string
  labelMap?: Record<string, string>
}

export default function MemoHistoryPanel({ title, memo, createdAt, onAddMemo, onClose, entityType, entityId, labelMap }: Props) {
  const [value, setValue] = useState('')
  const [notifLogs, setNotifLogs] = useState<NotificationLog[]>([])

  useEffect(() => {
    if (!entityType || !entityId) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('notification_logs')
      .select('id, template_key, status, error, created_at, user:profiles(name)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setNotifLogs((data as unknown as NotificationLog[]) ?? [])
      })
    return () => { cancelled = true }
  }, [entityType, entityId])

  const timeline = [
    ...parseMemoEntries(memo, createdAt).map(entry => ({ at: entry.at, node: (
      <li key={`memo-${entry.at}-${entry.text}`} className="text-[15pt] text-slate-200">
        <div className="text-slate-400">
          {new Date(entry.at).toLocaleString('ko-KR')}
          {' · '}
          <span className="font-semibold text-blue-300">{entry.user}</span>
        </div>
        <div>{entry.text}</div>
      </li>
    ) })),
    ...notifLogs.map(log => ({ at: log.created_at, node: (
      <li key={`notif-${log.id}`} className="text-[15pt] text-blue-400">
        <div className="text-slate-400">
          {new Date(log.created_at).toLocaleString('ko-KR')}
          {' · '}
          <span className="font-semibold text-blue-300">{log.user?.name ?? '알수없음'}</span>
        </div>
        <div>
          알림톡 발송 ({labelMap?.[log.template_key] ?? log.template_key})
          {log.status === 'failed' ? ` (실패${log.error ? `: ${log.error}` : ''})` : ''}
        </div>
      </li>
    ) })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  function submit() {
    if (!value.trim()) return
    onAddMemo(value)
    setValue('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[36rem] max-w-[calc(100vw-3rem)] h-[85vh] max-h-[85vh] flex flex-col bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <p className="flex items-center gap-2 text-base font-semibold">
          <HistoryIcon size={32} />
          히스토리 · {title}
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors" aria-label="닫기">
          <X size={20} />
        </button>
      </div>
      <div className="px-5 py-4 border-b border-slate-700">
        <label className="text-xs font-semibold text-slate-400">새 메모 추가</label>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={submit}
          placeholder="새 메모 입력..."
          rows={2}
          className="w-full mt-1 bg-slate-800 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-2 py-1.5 text-sm resize-y text-white"
        />
      </div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        {timeline.length === 0 ? (
          <p className="text-[15pt] text-slate-400">이력이 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">{timeline.map(entry => entry.node)}</ul>
        )}
      </div>
    </div>
  )
}
