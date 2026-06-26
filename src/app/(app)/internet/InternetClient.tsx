'use client'

import { useState, useTransition, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteInternetRows } from './actions'
import type { InternetManagement } from '@/types'

interface Props {
  rows: InternetManagement[]
}

const STATUSES = ['진행중', '개통완료', '취소']
const CATEGORIES = ['백메가', '3S']

const EMPTY_FORM = {
  business_name: '',
  apply_date: '',
  open_date: '',
  status: '',
  category: '',
  carrier: '',
  speed: '',
  addon: '',
  gift: '',
  owner_name: '',
  phone: '',
  region: '',
  monthly_fee: '',
  install_fee: '',
  memo: '',
}

const COLUMNS: { key: keyof InternetManagement; label: string }[] = [
  { key: 'business_name', label: '상호명' },
  { key: 'apply_date', label: '접수신청일' },
  { key: 'open_date', label: '개통완료일' },
  { key: 'status', label: '상태' },
  { key: 'category', label: '구분' },
  { key: 'carrier', label: '통신사' },
  { key: 'speed', label: '속도' },
  { key: 'addon', label: '추가 가입상품' },
  { key: 'gift', label: '사은품' },
  { key: 'owner_name', label: '대표자' },
  { key: 'phone', label: '연락처' },
  { key: 'region', label: '지역' },
  { key: 'monthly_fee', label: '월요금' },
  { key: 'install_fee', label: '설치비' },
  { key: 'memo', label: '비고' },
]

// --- EditableCell moved outside main component ---
interface EditableCellProps {
  row: InternetManagement
  field: keyof InternetManagement
  onSave: (row: InternetManagement, field: keyof InternetManagement, value: string) => void
}
const EditableCell = memo(function EditableCell({ row, field, onSave }: EditableCellProps) {
  const [value, setValue] = useState((row[field] as string) ?? '')
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== ((row[field] as string) ?? '')) onSave(row, field, value) }}
      className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm min-w-[100px]"
    />
  )
})

// --- Memoized table row ---
interface TableRowProps {
  row: InternetManagement
  isSelected: boolean
  onToggle: (id: string) => void
  onSave: (row: InternetManagement, field: keyof InternetManagement, value: string) => void
}
const TableRow = memo(function TableRow({ row, isSelected, onToggle, onSave }: TableRowProps) {
  return (
    <tr className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
      <td className="px-3 py-2">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
      </td>
      {COLUMNS.map(col => (
        <td key={col.key} className="px-3 py-2 whitespace-nowrap">
          {col.key === 'status' ? (
            <select
              value={row.status ?? ''}
              onChange={e => onSave(row, 'status', e.target.value)}
              className={`text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${
                row.status === '개통완료' ? 'bg-green-100 text-green-700' : row.status === '취소' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <option value="">-</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : col.key === 'category' ? (
            <select
              value={row.category ?? ''}
              onChange={e => onSave(row, 'category', e.target.value)}
              className="text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border-0 bg-slate-100 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
              <option value="">-</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <EditableCell row={row} field={col.key} onSave={onSave} />
          )}
        </td>
      ))}
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
      {COLUMNS.map(col => (
        <div key={col.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{col.label}</label>
          {col.key === 'status' ? (
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : col.key === 'category' ? (
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input value={form[col.key as keyof typeof form]} onChange={e => setForm({ ...form, [col.key]: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
        </div>
      ))}
      <button type="submit" disabled={submitting}
        className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
        {submitting ? '등록 중...' : '등록'}
      </button>
    </form>
  )
})

export default function InternetClient({ rows }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    setLocalRows(rows)
    setSelected(new Set())
  }, [rows])

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('internet_management-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internet_management' }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => startTransition(() => router.refresh()), 400)
      })
      .subscribe()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localRows.filter(row => {
      if (statusFilter && row.status !== statusFilter) return false
      if (categoryFilter && row.category !== categoryFilter) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''} ${row.region ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [localRows, search, statusFilter, categoryFilter])

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

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeleting(true)
    const { error } = await deleteInternetRows([...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }, [selected])

  const handleCreate = useCallback(async (form: typeof EMPTY_FORM) => {
    setSubmitting(true)
    const supabase = createClient()
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v || null])
    )
    const { error } = await supabase.from('internet_management').insert(payload)
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setShowForm(false)
    startTransition(() => router.refresh())
  }, [])

  const saveField = useCallback(async (row: InternetManagement, field: keyof InternetManagement, value: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('internet_management').update({ [field]: value || null }).eq('id', row.id)
    if (error) alert('수정 실패: ' + error.message)
    startTransition(() => router.refresh())
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 대표자, 연락처, 지역..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">상태 전체</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">구분 전체</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || statusFilter || categoryFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter('') }}
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
        <table className="w-full text-sm border-collapse min-w-[1800px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              {COLUMNS.map(col => (
                <th key={col.key} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <TableRow
                key={row.id}
                row={row}
                isSelected={selected.has(row.id)}
                onToggle={toggleOne}
                onSave={saveField}
              />
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 1} className="text-center text-slate-400 py-10">조건에 맞는 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
