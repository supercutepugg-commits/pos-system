'use client'

import { useState, useTransition, useEffect, useRef, useCallback, memo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, GripVertical } from 'lucide-react'
import { updateInboundRow, deleteInboundRows } from './actions'
import { createClient } from '@/lib/supabase/client'

export interface InboundRow {
  id: string
  date: string | null
  staff: string | null
  channel: string | null
  category: string | null
  status: string | null
  owner_name: string | null
  business_name: string | null
  phone: string | null
  inquiry: string | null
  answer: string | null
  chat_log: string | null
  ai_summary: string | null
  tech_note: string | null
  note: string | null
  sort_order?: number | null
}

const CHANNEL_COLORS: Record<string, string> = {
  '유선': 'bg-blue-100 text-blue-700',
  '채널톡': 'bg-emerald-100 text-emerald-700',
  '채널': 'bg-emerald-100 text-emerald-700',
  '슬랙': 'bg-purple-100 text-purple-700',
  '기타': 'bg-slate-100 text-slate-600',
}
const STATUS_COLORS: Record<string, string> = {
  '처리완료': 'bg-emerald-100 text-emerald-700',
  '단순문의': 'bg-emerald-50 text-emerald-600',
  '처리중': 'bg-blue-100 text-blue-700',
  '원격 진행중': 'bg-blue-100 text-blue-700',
  '처리대기': 'bg-yellow-100 text-yellow-700',
  '미처리': 'bg-red-100 text-red-700',
  '보류': 'bg-slate-100 text-slate-600',
  '발송대기': 'bg-orange-100 text-orange-700',
  '포스기 일정': 'bg-indigo-100 text-indigo-700',
  '인터넷 일정': 'bg-indigo-100 text-indigo-700',
  '카드가맹 일정': 'bg-indigo-100 text-indigo-700',
  '신규': 'bg-pink-100 text-pink-700',
  '기존': 'bg-slate-100 text-slate-600',
  '기타': 'bg-slate-100 text-slate-600',
}
const CATEGORY_COLORS: Record<string, string> = {
  'A/S': 'bg-red-100 text-red-700',
  '가입문의': 'bg-blue-100 text-blue-700',
  '일정문의': 'bg-indigo-100 text-indigo-700',
  '메뉴수정': 'bg-amber-100 text-amber-700',
  '매뉴수정': 'bg-amber-100 text-amber-700',
  '용지요청': 'bg-teal-100 text-teal-700',
  '기타문의': 'bg-slate-100 text-slate-600',
}

interface FilterOptions {
  staffs: string[]
  channels: string[]
  categories: string[]
  statuses: string[]
}

interface Props {
  rows: InboundRow[]
  totalCount: number
  page: number
  totalPages: number
  filterOptions: FilterOptions
  currentParams: Record<string, string | undefined>
  sortKey: string
  sortDir: 'asc' | 'desc'
}

// --- EditableText moved outside main component ---
interface EditableTextProps {
  row: InboundRow
  field: keyof InboundRow
  className?: string
  onSave: (id: string, field: string, value: string) => void
}
const EditableText = memo(function EditableText({ row, field, className, onSave }: EditableTextProps) {
  const [value, setValue] = useState(String(row[field] ?? ''))
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== (row[field] ?? '')) onSave(row.id, field, value) }}
      onClick={e => e.stopPropagation()}
      className={`w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 ${className ?? ''}`}
    />
  )
})

// --- EditableSelect moved outside main component ---
interface EditableSelectProps {
  row: InboundRow
  field: keyof InboundRow
  options: string[]
  colorMap: Record<string, string>
  onSave: (id: string, field: string, value: string) => void
}
const EditableSelect = memo(function EditableSelect({ row, field, options, colorMap, onSave }: EditableSelectProps) {
  const value = row[field] ?? ''
  const cls = value ? (colorMap[value as string] || 'bg-slate-100 text-slate-600') : ''
  return (
    <select
      value={value as string}
      onChange={e => onSave(row.id, field, e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${cls}`}
    >
      <option value="">-</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
})

export default function InboundClient({ rows, totalCount, page, totalPages, filterOptions, currentParams, sortKey, sortDir }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentParams.q ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [localRows, setLocalRows] = useState(rows)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowDragId, setRowDragId] = useState<string | null>(null)

  useEffect(() => {
    setLocalRows(rows)
    setSelected(new Set())
  }, [rows])

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('crm_inbound-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_inbound' }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => {
          startTransition(() => router.refresh())
        }, 400)
      })
      .subscribe()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  function pushParams(next: Record<string, string | undefined>) {
    const merged = { ...currentParams, ...next }
    const qs = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) qs.set(k, v) })
    startTransition(() => router.push(`/inbound?${qs.toString()}`))
  }

  function toggleSort(key: string) {
    if (sortKey === key) pushParams({ sort: key, dir: sortDir === 'asc' ? 'desc' : 'asc' })
    else pushParams({ sort: key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-blue-500" />
      : <ChevronDown size={13} className="text-blue-500" />
  }

  function Badge({ text, colorMap }: { text: string | null; colorMap: Record<string, string> }) {
    if (!text) return <span className="text-slate-300">-</span>
    const cls = colorMap[text] || 'bg-slate-100 text-slate-600'
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{text}</span>
  }

  const allChecked = localRows.length > 0 && selected.size === localRows.length

  const toggleAll = useCallback(() => {
    setSelected(allChecked ? new Set() : new Set(localRows.map(r => r.id)))
  }, [allChecked, localRows])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeleting(true)
    const { error } = await deleteInboundRows([...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }, [selected])

  const saveField = useCallback(async (id: string, field: string, value: string) => {
    setLocalRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    setSavingId(id)
    const { error } = await updateInboundRow(id, { [field]: value || null })
    setSavingId(null)
    if (error) alert('수정 실패: ' + error)
  }, [])

  // "직접 정렬" 모드 + 검색/필터 없이 전체가 한 페이지에 들어올 때만 드래그 재정렬 허용
  // (서버 페이지네이션 특성상 여러 페이지에 걸쳐 있으면 sort_order 값이 서로 충돌할 수 있음)
  const canReorder = sortKey === 'sort_order' && totalPages <= 1
    && !currentParams.q && !currentParams.staff && !currentParams.channel
    && !currentParams.category && !currentParams.status && !currentParams.from && !currentParams.to

  const reorderRows = useCallback((dragId: string, dropId: string) => {
    if (dragId === dropId) return
    const from = localRows.findIndex(r => r.id === dragId)
    const to = localRows.findIndex(r => r.id === dropId)
    if (from === -1 || to === -1) return
    const next = [...localRows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLocalRows(next)
    const n = next.length
    const supabase = createClient()
    Promise.all(next.map((r, i) =>
      supabase.from('crm_inbound').update({ sort_order: (n - i) * 1000 }).eq('id', r.id)
    )).catch(() => alert('순서 저장에 실패했습니다.'))
  }, [localRows])

  return (
    <div className="flex flex-col h-full">
      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <form onSubmit={e => { e.preventDefault(); pushParams({ q: search, page: undefined }) }} className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 대표자, 연락처, 문의내용..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
        <select value={currentParams.staff ?? ''} onChange={e => pushParams({ staff: e.target.value || undefined, page: undefined })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">담당자 전체</option>
          {filterOptions.staffs.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={currentParams.channel ?? ''} onChange={e => pushParams({ channel: e.target.value || undefined, page: undefined })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">인입채널 전체</option>
          {filterOptions.channels.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={currentParams.category ?? ''} onChange={e => pushParams({ category: e.target.value || undefined, page: undefined })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">분류 전체</option>
          {filterOptions.categories.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={currentParams.status ?? ''} onChange={e => pushParams({ status: e.target.value || undefined, page: undefined })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">진행상황 전체</option>
          {filterOptions.statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={currentParams.from ?? ''} onChange={e => pushParams({ from: e.target.value || undefined, page: undefined })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-slate-400 text-sm">~</span>
          <input type="date" value={currentParams.to ?? ''} onChange={e => pushParams({ to: e.target.value || undefined, page: undefined })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(currentParams.q || currentParams.staff || currentParams.channel || currentParams.category || currentParams.status || currentParams.from || currentParams.to) && (
          <button onClick={() => { setSearch(''); router.push('/inbound') }}
            className="text-sm text-slate-400 hover:text-red-500 px-2 py-2 transition-colors">
            초기화
          </button>
        )}
        <button onClick={() => pushParams({ sort: sortKey === 'sort_order' ? 'date' : 'sort_order', dir: 'desc', page: undefined })}
          title={sortKey === 'sort_order' && !canReorder ? '검색/필터가 있거나 결과가 여러 페이지에 걸쳐 있으면 드래그할 수 없습니다' : undefined}
          className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${sortKey === 'sort_order' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
          직접 정렬{canReorder ? ' (드래그로 순서 변경)' : ''}
        </button>
        {/* 프리셋 필터 버튼 */}
        <div className="flex gap-1">
          <button
            onClick={() => pushParams({ status: '미처리', page: undefined, q: undefined, staff: undefined, channel: undefined, category: undefined, from: undefined, to: undefined })}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${currentParams.status === '미처리' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'}`}
          >🚨 미처리</button>
          <button
            onClick={() => { const today = new Date().toISOString().slice(0,10); pushParams({ from: today, to: today, page: undefined, q: undefined, staff: undefined, channel: undefined, category: undefined, status: undefined }) }}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >📅 오늘 접수</button>
          <button
            onClick={() => pushParams({ category: 'A/S', page: undefined, q: undefined, staff: undefined, channel: undefined, status: undefined, from: undefined, to: undefined })}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${currentParams.category === 'A/S' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'}`}
          >🔧 A/S 건</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm font-semibold text-blue-700">{selected.size}건 선택됨</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                {deleting ? '삭제 중...' : '선택 삭제'}
              </button>
            </>
          )}
          <div className="text-sm text-slate-500">
            전체 {totalCount.toLocaleString()}건 ({page}/{totalPages} 페이지)
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1200px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-1 py-2.5 border-b border-slate-200 w-6" />
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              {([
                ['date', '날짜', 90],
                ['staff', '담당자', 80],
                ['channel', '인입채널', 90],
                ['category', '분류', 90],
                ['status', '진행상황', 100],
                ['owner_name', '대표자명', 90],
                ['business_name', '상호명', 120],
                ['phone', '연락처', 120],
                ['inquiry', '문의내용', null],
                ['answer', '답변내용', null],
              ] as [string, string, number | null][]).map(([key, label, w]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                  style={w ? { width: w, minWidth: w } : { minWidth: 150 }}
                >
                  <span className="flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localRows.map(row => (
              <Fragment key={row.id}>
                <tr
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${savingId === row.id ? 'opacity-60' : ''} ${rowDragId === row.id ? 'opacity-40' : ''}`}
                  onDragOver={e => { if (canReorder && rowDragId) e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); if (rowDragId) reorderRows(rowDragId, row.id) }}
                >
                  <td
                    className={`px-1 py-2 text-slate-700 ${canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30'}`}
                    onClick={e => e.stopPropagation()}
                    draggable={canReorder}
                    onDragStart={e => { if (!canReorder) { e.preventDefault(); return } setRowDragId(row.id) }}
                    onDragEnd={() => setRowDragId(null)}
                    title={canReorder ? '드래그해서 순서 변경' : '"직접 정렬" 모드 + 검색/필터 없이 한 페이지에 다 보일 때만 순서를 바꿀 수 있습니다'}
                  >
                    <GripVertical size={14} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                    {row.date ? row.date.slice(0, 10) : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    <EditableText row={row} field="staff" onSave={saveField} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableSelect row={row} field="channel" options={Object.keys(CHANNEL_COLORS)} colorMap={CHANNEL_COLORS} onSave={saveField} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableSelect row={row} field="category" options={Object.keys(CATEGORY_COLORS)} colorMap={CATEGORY_COLORS} onSave={saveField} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableSelect row={row} field="status" options={Object.keys(STATUS_COLORS)} colorMap={STATUS_COLORS} onSave={saveField} />
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    <EditableText row={row} field="owner_name" onSave={saveField} />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                    <EditableText row={row} field="business_name" onSave={saveField} />
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    <EditableText row={row} field="phone" onSave={saveField} />
                  </td>
                  <td className="px-3 py-2 text-slate-700 max-w-[250px]" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                    <div className="truncate cursor-pointer">{row.inquiry || '-'}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[250px]" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                    <div className="truncate cursor-pointer">{row.answer || '-'}</div>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-blue-50">
                    <td colSpan={12} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">문의내용</p>
                          <textarea
                            defaultValue={row.inquiry ?? ''}
                            onBlur={e => { if (e.target.value !== (row.inquiry ?? '')) saveField(row.id, 'inquiry', e.target.value) }}
                            className="w-full text-slate-600 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            rows={3}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">답변내용</p>
                          <textarea
                            defaultValue={row.answer ?? ''}
                            onBlur={e => { if (e.target.value !== (row.answer ?? '')) saveField(row.id, 'answer', e.target.value) }}
                            className="w-full text-slate-600 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            rows={3}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">추가내용 (기술적)</p>
                          <textarea
                            defaultValue={row.tech_note ?? ''}
                            onBlur={e => { if (e.target.value !== (row.tech_note ?? '')) saveField(row.id, 'tech_note', e.target.value) }}
                            className="w-full text-slate-600 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            rows={2}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">비고</p>
                          <textarea
                            defaultValue={row.note ?? ''}
                            onBlur={e => { if (e.target.value !== (row.note ?? '')) saveField(row.id, 'note', e.target.value) }}
                            className="w-full text-slate-600 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            rows={2}
                          />
                        </div>
                        {row.ai_summary && (
                          <div className="col-span-2">
                            <p className="font-semibold text-slate-700 mb-1">AI 요약</p>
                            <p className="text-slate-600 whitespace-pre-wrap">{row.ai_summary}</p>
                          </div>
                        )}
                        {row.chat_log && (
                          <div className="col-span-2">
                            <p className="font-semibold text-slate-700 mb-1">대화 원본</p>
                            <p className="text-slate-500 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{row.chat_log}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {localRows.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-16 text-slate-400">
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-3">
          <button
            onClick={() => pushParams({ page: String(Math.max(1, page - 1)) })}
            disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:pointer-events-none"
          >
            이전
          </button>
          <span className="text-sm text-slate-500 font-medium">{page} / {totalPages}</span>
          <button
            onClick={() => pushParams({ page: String(Math.min(totalPages, page + 1)) })}
            disabled={page >= totalPages}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:pointer-events-none"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
