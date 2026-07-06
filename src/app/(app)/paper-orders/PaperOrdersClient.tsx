'use client'

import { useState, useTransition, useMemo, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function calcUnitStandard(count: string | null, revenue: string | null): string {
  const c = parseFloat((count ?? '').replace(/,/g, ''))
  const r = parseFloat((revenue ?? '').replace(/,/g, ''))
  if (isNaN(c) || isNaN(r)) return ''
  if (c >= 1500 || r >= 3000) return '1박스'
  if (c < 150) return '4롤'
  if (c < 300) return '6롤'
  if (c < 500) return '8롤'
  if (c < 700) return '10롤'
  if (c < 900) return '12롤'
  if (c < 1100) return '15롤'
  if (c < 1200) return '16롤'
  return '18롤'
}

export interface PaperOrder {
  id: string
  shipped: boolean
  business_name: string | null
  owner_name: string | null
  phone: string | null
  address: string | null
  delivery_note: string | null
  requested_at: string | null
  shipped_at: string | null
  count: string | null
  revenue: string | null
  unit_standard: string | null
  memo: string | null
  sort_order?: number | null
  created_at: string
}

const EMPTY_FORM = {
  shipped: false,
  business_name: '',
  owner_name: '',
  phone: '',
  address: '',
  delivery_note: '',
  requested_at: '',
  shipped_at: '',
  count: '',
  revenue: '',
  unit_standard: '',
  memo: '',
}

const PAGE_SIZE = 100

// --- EditableCell moved outside main component ---
interface EditableCellProps {
  row: PaperOrder
  field: keyof PaperOrder
  onSave: (row: PaperOrder, field: keyof PaperOrder, value: string) => void
}
const EditableCell = memo(function EditableCell({ row, field, onSave }: EditableCellProps) {
  const [value, setValue] = useState((row[field] as string) ?? '')
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== ((row[field] as string) ?? '')) onSave(row, field, value) }}
      className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-sm"
    />
  )
})

// --- Memoized table row ---
interface TableRowProps {
  row: PaperOrder
  isSelected: boolean
  onToggle: (id: string) => void
  onToggleShipped: (row: PaperOrder) => void
  onSave: (row: PaperOrder, field: keyof PaperOrder, value: string) => void
  canReorder: boolean
  isDragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDropOn: (id: string) => void
}
const TableRow = memo(function TableRow({ row, isSelected, onToggle, onToggleShipped, onSave, canReorder, isDragging, onDragStart, onDragEnd, onDropOn }: TableRowProps) {
  return (
    <tr
      className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${row.shipped ? '' : 'bg-yellow-50/40'} ${isDragging ? 'opacity-40' : ''}`}
      onDragOver={e => { if (canReorder) e.preventDefault() }}
      onDrop={e => { e.preventDefault(); onDropOn(row.id) }}
    >
      <td
        className={`px-1 py-2 text-slate-300 ${canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30'}`}
        draggable={canReorder}
        onDragStart={e => { if (!canReorder) { e.preventDefault(); return } onDragStart(row.id) }}
        onDragEnd={onDragEnd}
        title={canReorder ? '드래그해서 순서 변경' : '검색/필터 중에는 순서를 변경할 수 없습니다'}
      >
        <GripVertical size={14} />
      </td>
      <td className="px-3 py-2">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={row.shipped}
          onChange={() => onToggleShipped(row)}
          className="w-4 h-4 accent-blue-600 cursor-pointer"
          title={row.shipped ? '발송완료' : '미발송'}
        />
      </td>
      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap min-w-[120px]"><EditableCell row={row} field="business_name" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]"><EditableCell row={row} field="owner_name" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[120px]"><EditableCell row={row} field="phone" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-500 max-w-[200px]"><EditableCell row={row} field="address" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]"><EditableCell row={row} field="delivery_note" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]"><EditableCell row={row} field="requested_at" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]"><EditableCell row={row} field="shipped_at" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[60px]"><EditableCell row={row} field="count" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[70px]"><EditableCell row={row} field="revenue" onSave={onSave} /></td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[100px]">
        <span className="text-sm px-1">{row.unit_standard || calcUnitStandard(row.count, row.revenue)}</span>
      </td>
      <td className="px-3 py-2 text-slate-500 max-w-[150px]"><EditableCell row={row} field="memo" onSave={onSave} /></td>
    </tr>
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
    await onSubmit(form)
    setForm(EMPTY_FORM)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1 justify-end">
        <label className="text-xs font-medium text-slate-500">발송완료</label>
        <div className="flex items-center h-9">
          <input type="checkbox" checked={form.shipped} onChange={e => setForm({ ...form, shipped: e.target.checked })} className="w-4 h-4 accent-blue-600 cursor-pointer" />
        </div>
      </div>
      {([
        ['상호명', 'business_name'],
        ['성함', 'owner_name'],
        ['연락처', 'phone'],
        ['주소', 'address'],
        ['택배', 'delivery_note'],
        ['요청일', 'requested_at'],
        ['발송일', 'shipped_at'],
        ['건수', 'count'],
        ['매출', 'revenue'],
        ['메모', 'memo'],
      ] as [string, string][]).map(([label, key]) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{label}</label>
          <input
            value={(form as any)[key]}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">낱개기준(빨강)</label>
        <div className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 bg-slate-50 text-slate-700 h-9 flex items-center">
          {calcUnitStandard(form.count, form.revenue) || '-'}
        </div>
      </div>
      <button type="submit" disabled={submitting}
        className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
        {submitting ? '등록 중...' : '등록'}
      </button>
    </form>
  )
})

interface Props {
  rows: PaperOrder[]
}

export default function PaperOrdersClient({ rows }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [shippedFilter, setShippedFilter] = useState<'all' | 'shipped' | 'pending'>('all')
  const [page, setPage] = useState(1)
  const [rowDragId, setRowDragId] = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localRows.filter(row => {
      if (shippedFilter === 'shipped' && !row.shipped) return false
      if (shippedFilter === 'pending' && row.shipped) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [localRows, search, shippedFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredRows, page])

  const canReorder = !search.trim() && shippedFilter === 'all'

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
      supabase.from('paper_orders').update({ sort_order: (n - i) * 1000 }).eq('id', r.id)
    )).catch(() => alert('순서 저장에 실패했습니다.'))
  }, [localRows])

  const allChecked = pagedRows.length > 0 && pagedRows.every(r => selected.has(r.id))

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (allChecked) {
        const next = new Set(prev)
        pagedRows.forEach(r => next.delete(r.id))
        return next
      }
      return new Set([...prev, ...pagedRows.map(r => r.id)])
    })
  }, [allChecked, pagedRows])

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
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').delete().in('id', [...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
  }, [selected])

  const handleCreate = useCallback(async (form: typeof EMPTY_FORM) => {
    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('paper_orders').insert({
      shipped: form.shipped,
      business_name: form.business_name || null,
      owner_name: form.owner_name || null,
      phone: form.phone || null,
      address: form.address || null,
      delivery_note: form.delivery_note || null,
      requested_at: form.requested_at || null,
      shipped_at: form.shipped_at || null,
      count: form.count || null,
      revenue: form.revenue || null,
      unit_standard: form.unit_standard || calcUnitStandard(form.count, form.revenue) || null,
      memo: form.memo || null,
    }).select().single()
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setLocalRows(prev => [...prev, data])
    setShowForm(false)
  }, [])

  const toggleShipped = useCallback(async (row: PaperOrder) => {
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').update({ shipped: !row.shipped }).eq('id', row.id)
    if (error) { alert('수정 실패: ' + error.message); return }
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, shipped: !r.shipped } : r))
  }, [])

  const saveField = useCallback(async (row: PaperOrder, field: keyof PaperOrder, value: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').update({ [field]: value || null }).eq('id', row.id)
    if (error) alert('수정 실패: ' + error.message)
    else setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: value || null } : r))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="상호명, 성함, 연락처..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={shippedFilter} onChange={e => { setShippedFilter(e.target.value as any); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체</option>
          <option value="shipped">발송완료</option>
          <option value="pending">미발송</option>
        </select>
        {(search || shippedFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setShippedFilter('all'); setPage(1) }}
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
            등록
          </button>
        </div>
      </div>

      {showForm && <CreateForm onSubmit={handleCreate} submitting={submitting} />}

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1400px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-1 py-2.5 border-b border-slate-200 w-6" />
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              <th className="px-3 py-2.5 border-b border-slate-200 text-left font-semibold text-slate-600 whitespace-nowrap">상태</th>
              {['상호명', '성함', '연락처', '주소', '택배', '요청일', '발송일', '건수', '매출', '낱개기준(빨강)', '메모'].map(label => (
                <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map(row => (
              <TableRow
                key={row.id}
                row={row}
                isSelected={selected.has(row.id)}
                onToggle={toggleOne}
                onToggleShipped={toggleShipped}
                onSave={saveField}
                canReorder={canReorder}
                isDragging={rowDragId === row.id}
                onDragStart={setRowDragId}
                onDragEnd={() => setRowDragId(null)}
                onDropOn={dropId => { if (rowDragId) reorderRows(rowDragId, dropId) }}
              />
            ))}
            {pagedRows.length === 0 && (
              <tr><td colSpan={14} className="text-center text-slate-400 py-10">데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:pointer-events-none"
          >
            이전
          </button>
          <span className="text-sm text-slate-500 font-medium">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
