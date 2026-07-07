'use client'

import { useState, useEffect, useRef, useMemo, useCallback, memo, Fragment } from 'react'
import { Plus, Trash2, Search, ChevronDown, ChevronUp, Calendar, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, formatBusinessNumber, formatDateText } from '@/lib/format'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import { mergeRowsPreservingIdentity } from '@/lib/mergeRows'
import { deleteWooRows } from './actions'
import type { WooCustomer } from '@/types'
import { useToast } from '@/components/ui/Toast'

interface Props {
  rows: WooCustomer[]
}

const CATEGORIES = ['명의변경', '승계', '신규']

const SELECT_OPTIONS: Partial<Record<keyof WooCustomer, string[]>> = {
  category: CATEGORIES,
  internet_type: ['3S', '백메가'],
  card_apply_status: ['가맹완료', '가맹미확인'],
  setting: ['PC세팅', '포스세팅'],
}

const REQUIRED_FIELDS: (keyof WooCustomer)[] = ['internet_note']

// 가맹여부 값에 따른 배지 색상 (가맹완료: 초록, 가맹미확인: 슬레이트 기본)
function cardApplyStatusColor(value: string) {
  if (value === '가맹완료') return 'bg-green-50 text-green-600 border-green-200'
  if (value === '가맹미확인') return 'bg-red-50 text-red-600 border-red-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

// 달력 선택 + 직접 텍스트 입력 둘 다 되는 필드
const DATE_FIELDS: (keyof WooCustomer)[] = ['received_date', 'open_date', 'internet_open_date', 'card_apply_date']

const AUTO_FORMAT: Partial<Record<keyof WooCustomer, (raw: string) => string>> = {
  phone: formatPhone,
  business_number: formatBusinessNumber,
}

const EMPTY_FORM = {
  received_date: '',
  category: '',
  business_name: '',
  owner_name: '',
  business_number: '',
  phone: '',
  internet_type: '',
  internet_note: '',
  internet_open_date: '',
  card_apply_date: '',
  card_apply_status: '',
  easy_payment: '',
  setting: '',
  open_date: '',
  pos_program: '',
  address: '',
  memo: '',
}

// 목록에 항상 보이는 핵심 컬럼
const MAIN_COLUMNS: { key: keyof WooCustomer; label: string }[] = [
  { key: 'category', label: '분류' },
  { key: 'received_date', label: '접수날짜' },
  { key: 'open_date', label: '오픈일' },
  { key: 'business_name', label: '상호명' },
  { key: 'owner_name', label: '대표자명' },
  { key: 'phone', label: '연락처' },
  { key: 'card_apply_status', label: '가맹여부' },
  { key: 'setting', label: '세팅' },
  { key: 'easy_payment', label: '간편결제' },
  { key: 'internet_note', label: '인터넷 비고' },
]

// 상세보기(펼침)에만 나오는 컬럼
const DETAIL_COLUMNS: { key: keyof WooCustomer; label: string }[] = [
  { key: 'business_number', label: '사업자번호' },
  { key: 'internet_type', label: '인터넷' },
  { key: 'internet_open_date', label: '인터넷 개통일자' },
  { key: 'card_apply_date', label: '카드가맹 접수일자' },
  { key: 'pos_program', label: '포스프로그램' },
  { key: 'address', label: '주소' },
  { key: 'memo', label: '비고' },
]

const COLUMNS = [...MAIN_COLUMNS, ...DETAIL_COLUMNS]

const DEFAULT_WIDTHS: Partial<Record<keyof WooCustomer, number>> = {
  category: 90,
  received_date: 100,
  open_date: 100,
  business_name: 160,
  owner_name: 100,
  phone: 130,
  card_apply_status: 100,
  setting: 90,
  easy_payment: 140,
  internet_note: 160,
}
const COL_WIDTHS_STORAGE_KEY = 'woo_customers_col_widths'
const PAGE_SIZE = 50

// --- EditableText moved outside main component ---
interface EditableTextProps {
  row: WooCustomer
  field: keyof WooCustomer
  onSave: (row: WooCustomer, field: keyof WooCustomer, value: string) => void
}
const EditableText = memo(function EditableText({ row, field, onSave }: EditableTextProps) {
  const [value, setValue] = useState((row[field] as string) ?? '')
  const autoFormat = AUTO_FORMAT[field]
  return (
    <input
      value={value}
      onChange={e => setValue(autoFormat ? autoFormat(e.target.value) : e.target.value)}
      onBlur={() => {
        if (value !== ((row[field] as string) ?? '')) onSave(row, field, value)
      }}
      onClick={e => e.stopPropagation()}
      className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
    />
  )
})

// 달력 아이콘으로 날짜를 고르거나, 텍스트를 직접 입력할 수도 있는 필드
interface DateFieldProps {
  row: WooCustomer
  field: keyof WooCustomer
  onSave: (row: WooCustomer, field: keyof WooCustomer, value: string) => void
}
const DateField = memo(function DateField({ row, field, onSave }: DateFieldProps) {
  const [value, setValue] = useState((row[field] as string) ?? '')
  const dateInputRef = useRef<HTMLInputElement>(null)
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation()
    const el = dateInputRef.current
    if (!el) return
    const withPicker = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') withPicker.showPicker()
    else el.focus()
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setValue(next)
    onSave(row, field, next)
  }

  return (
    <div className="flex items-center gap-1 w-full">
      <input
        value={value}
        onChange={e => setValue(formatDateText(e.target.value))}
        onBlur={() => {
          if (value !== ((row[field] as string) ?? '')) onSave(row, field, value)
        }}
        onClick={e => e.stopPropagation()}
        placeholder="날짜 또는 텍스트"
        className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
      />
      <button type="button" onClick={openPicker} tabIndex={-1}
        className="shrink-0 text-slate-400 hover:text-blue-500">
        <Calendar size={14} />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={isoValue}
        onChange={handlePick}
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
        className="w-0 h-0 opacity-0 absolute pointer-events-none"
      />
    </div>
  )
})

interface SelectFieldProps {
  row: WooCustomer
  field: keyof WooCustomer
  options: string[]
  onSave: (row: WooCustomer, field: keyof WooCustomer, value: string) => void
  pill?: boolean
}
const SelectField = memo(function SelectField({ row, field, options, onSave, pill }: SelectFieldProps) {
  const pillColor = field === 'card_apply_status' ? cardApplyStatusColor((row[field] as string) ?? '') : 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <select
      value={(row[field] as string) ?? ''}
      onChange={e => onSave(row, field, e.target.value)}
      onClick={e => e.stopPropagation()}
      className={pill
        ? `text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${pillColor}`
        : 'w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm'}
    >
      <option value="">-</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
})

// 달력 아이콘 + 직접 텍스트 입력 - 등록 폼용 (row 없이 value/onChange만 받음)
interface DateFormFieldProps {
  value: string
  onChange: (value: string) => void
}
const DateFormField = memo(function DateFormField({ value, onChange }: DateFormFieldProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''

  function openPicker() {
    const el = dateInputRef.current
    if (!el) return
    const withPicker = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') withPicker.showPicker()
    else el.focus()
  }

  return (
    <div className="flex items-center gap-1">
      <input value={value} onChange={e => onChange(formatDateText(e.target.value))} placeholder="날짜 또는 텍스트"
        className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" onClick={openPicker} className="shrink-0 text-slate-400 hover:text-blue-500">
        <Calendar size={14} />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={isoValue}
        onChange={e => onChange(e.target.value)}
        className="w-0 h-0 opacity-0 absolute pointer-events-none"
      />
    </div>
  )
})

// --- Separate form component ---
interface CreateFormProps {
  onSubmit: (form: typeof EMPTY_FORM) => Promise<void>
  submitting: boolean
}
const CreateForm = memo(function CreateForm({ onSubmit, submitting }: CreateFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    for (const field of REQUIRED_FIELDS) {
      const col = COLUMNS.find(c => c.key === field)
      if (!form[field as keyof typeof form]?.trim()) {
        alert(`${col?.label ?? field}은(는) 필수 입력 항목입니다.`)
        return
      }
    }
    await onSubmit(form)
    setForm(EMPTY_FORM)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
      {COLUMNS.map(col => {
        const options = SELECT_OPTIONS[col.key]
        const required = REQUIRED_FIELDS.includes(col.key)
        return (
          <div key={col.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">
              {col.label}{required && <span className="text-red-500"> *</span>}
            </label>
            {options ? (
              <select value={form[col.key as keyof typeof form]} onChange={e => setForm({ ...form, [col.key]: e.target.value })}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">선택 안함</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : DATE_FIELDS.includes(col.key) ? (
              <DateFormField value={form[col.key as keyof typeof form]} onChange={v => setForm({ ...form, [col.key]: v })} />
            ) : (
              <input value={form[col.key as keyof typeof form]}
                onChange={e => { const fmt = AUTO_FORMAT[col.key]; setForm({ ...form, [col.key]: fmt ? fmt(e.target.value) : e.target.value }) }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
        )
      })}
      <button type="submit" disabled={submitting}
        className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
        {submitting ? '등록 중...' : '등록'}
      </button>
    </form>
  )
})

export default function WooClient({ rows }: Props) {
  const toast = useToast()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rowDragId, setRowDragId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { colWidths, startResize } = useColumnWidths(COL_WIDTHS_STORAGE_KEY, DEFAULT_WIDTHS as Record<string, number>)

  useEffect(() => {
    setLocalRows(prev => mergeRowsPreservingIdentity(prev, rows))
    setSelected(new Set())
  }, [rows])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('woo_customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'woo_customers' }, payload => {
        // 서버 재조회 없이 실시간 페이로드로 화면만 바로 패치 (다른 사용자의 변경사항 포함)
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new as WooCustomer
          setLocalRows(prev => prev.some(r => r.id === newRow.id) ? prev : [newRow, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as WooCustomer
          setLocalRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as WooCustomer).id
          setLocalRows(prev => prev.filter(r => r.id !== oldId))
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localRows.filter(row => {
      if (categoryFilter && row.category !== categoryFilter) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''} ${row.address ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [localRows, search, categoryFilter])

  useEffect(() => { setPage(1) }, [search, categoryFilter])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canReorder = !search.trim() && !categoryFilter

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
      supabase.from('woo_customers').update({ sort_order: (n - i) * 1000 }).eq('id', r.id)
    )).catch(() => toast.error('순서 저장에 실패했습니다.'))
  }, [localRows, toast])

  const allChecked = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id))

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (allChecked) {
        const next = new Set(prev)
        filteredRows.forEach(r => next.delete(r.id))
        return next
      }
      return new Set([...prev, ...filteredRows.map(r => r.id)])
    })
  }, [allChecked, filteredRows])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeleting(true)
    const { error } = await deleteWooRows([...selected])
    setDeleting(false)
    if (error) { toast.error('삭제 실패: ' + error); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
  }, [selected])

  const handleCreate = useCallback(async (form: typeof EMPTY_FORM) => {
    setSubmitting(true)
    const supabase = createClient()
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v || null])
    )
    const { error } = await supabase.from('woo_customers').insert(payload)
    setSubmitting(false)
    if (error) { toast.error('등록 실패: ' + error.message); return }
    setShowForm(false)
    // 새 행은 실시간 구독의 INSERT 이벤트로 화면에 반영됨
  }, [])

  const saveField = useCallback(async (row: WooCustomer, field: keyof WooCustomer, value: string) => {
    if (REQUIRED_FIELDS.includes(field) && !value.trim()) {
      toast.warning(`${COLUMNS.find(c => c.key === field)?.label ?? field}은(는) 필수 입력 항목입니다.`)
      return
    }
    // 화면은 바로 반영 (서버 재조회를 기다리지 않음 - 실시간 구독이 다른 사용자 변경사항은 알아서 동기화)
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: value } : r))
    const supabase = createClient()
    const { error } = await supabase.from('woo_customers').update({ [field]: value || null }).eq('id', row.id)
    if (error) toast.error('수정 실패: ' + error.message)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 대표자, 연락처, 주소..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">분류 전체</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || categoryFilter) && (
          <button onClick={() => { setSearch(''); setCategoryFilter('') }}
            className="text-sm text-slate-400 hover:text-red-500 px-2 py-2 transition-colors">
            초기화
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm font-semibold text-blue-700">{selected.size}건 선택됨</span>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 size={14} />
                {deleting ? '삭제 중...' : '선택 삭제'}
              </button>
            </>
          )}
          <div className="text-sm text-slate-500">전체 {filteredRows.length.toLocaleString()}건</div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />
            정보 입력
          </button>
        </div>
      </div>

      {showForm && <CreateForm onSubmit={handleCreate} submitting={submitting} />}

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 24 }} />
            <col style={{ width: 32 }} />
            <col style={{ width: 24 }} />
            {MAIN_COLUMNS.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 140 }} />
            ))}
          </colgroup>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-1 py-3 border-b border-slate-200" />
              <th className="px-3 py-3 border-b border-slate-200">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              <th className="px-3 py-3 border-b border-slate-200" />
              {MAIN_COLUMNS.map(col => (
                <th key={col.key} title={col.label} className="relative text-left px-3 py-3 font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap overflow-hidden text-ellipsis select-none">
                  {col.label}
                  <div
                    onMouseDown={e => startResize(e, col.key)}
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/60"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map(row => (
              <Fragment key={row.id}>
                <tr
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer ${rowDragId === row.id ? 'opacity-40' : ''}`}
                  onClick={() => toggleExpand(row.id)}
                  onDragOver={e => { if (canReorder && rowDragId) e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); if (rowDragId) reorderRows(rowDragId, row.id) }}
                >
                  <td
                    className={`px-1 py-3 text-slate-700 ${canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30'}`}
                    onClick={e => e.stopPropagation()}
                    draggable={canReorder}
                    onDragStart={e => { if (!canReorder) { e.preventDefault(); return } setRowDragId(row.id) }}
                    onDragEnd={() => setRowDragId(null)}
                    title={canReorder ? '드래그해서 순서 변경' : '검색/필터 중에는 순서를 변경할 수 없습니다'}
                  >
                    <GripVertical size={14} />
                  </td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {expandedId === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                  {MAIN_COLUMNS.map(col => {
                    const options = SELECT_OPTIONS[col.key]
                    return (
                      <td key={col.key} className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                        {options ? (
                          <SelectField row={row} field={col.key} options={options} onSave={saveField} pill />
                        ) : col.key === 'business_name' ? (
                          <span className="font-medium text-slate-900">{row.business_name || '-'}</span>
                        ) : DATE_FIELDS.includes(col.key) ? (
                          <DateField row={row} field={col.key} onSave={saveField} />
                        ) : (
                          <EditableText row={row} field={col.key} onSave={saveField} />
                        )}
                      </td>
                    )
                  })}
                </tr>
                {expandedId === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-blue-50/50 border-b border-slate-100">
                    <td colSpan={MAIN_COLUMNS.length + 3} className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4">
                        {DETAIL_COLUMNS.map(col => {
                          const options = SELECT_OPTIONS[col.key]
                          const required = REQUIRED_FIELDS.includes(col.key)
                          const wide = col.key === 'address' || col.key === 'memo'
                          return (
                            <div key={col.key} className={wide ? 'col-span-4' : ''}>
                              <label className="text-xs font-semibold text-slate-400">
                                {col.label}{required && <span className="text-red-500"> *</span>}
                              </label>
                              {options ? (
                                <SelectField row={row} field={col.key} options={options} onSave={saveField} />
                              ) : DATE_FIELDS.includes(col.key) ? (
                                <DateField row={row} field={col.key} onSave={saveField} />
                              ) : (
                                <EditableText row={row} field={col.key} onSave={saveField} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={MAIN_COLUMNS.length + 3} className="text-center text-slate-400 py-10">조건에 맞는 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">이전</button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">다음</button>
        </div>
      )}
    </div>
  )
}
