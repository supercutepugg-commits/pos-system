'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STATUS_OPTIONS = ['발송완료', '완료', '보류', '재발송']
const STATUS_COLOR: Record<string, string> = {
  발송완료: 'bg-green-100 text-green-700',
  완료: 'bg-blue-100 text-blue-700',
  보류: 'bg-yellow-100 text-yellow-700',
  재발송: 'bg-orange-100 text-orange-700',
}

export interface PaperOrder {
  id: string
  status: string | null
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
  created_at: string
}

const EMPTY_FORM = {
  status: '',
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

interface Props {
  rows: PaperOrder[]
}

export default function PaperOrdersClient({ rows }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localRows.filter(row => {
      if (statusFilter && row.status !== statusFilter) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [localRows, search, statusFilter])

  const allChecked = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id))
  function toggleAll() {
    setSelected(prev => {
      if (allChecked) {
        const next = new Set(prev)
        filteredRows.forEach(r => next.delete(r.id))
        return next
      }
      return new Set([...prev, ...filteredRows.map(r => r.id)])
    })
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
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').delete().in('id', [...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').insert({
      status: form.status || null,
      business_name: form.business_name || null,
      owner_name: form.owner_name || null,
      phone: form.phone || null,
      address: form.address || null,
      delivery_note: form.delivery_note || null,
      requested_at: form.requested_at || null,
      shipped_at: form.shipped_at || null,
      count: form.count || null,
      revenue: form.revenue || null,
      unit_standard: form.unit_standard || null,
      memo: form.memo || null,
    })
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setForm(EMPTY_FORM)
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function saveField(row: PaperOrder, field: keyof PaperOrder, value: string) {
    const supabase = createClient()
    const { error } = await supabase.from('paper_orders').update({ [field]: value || null }).eq('id', row.id)
    if (error) alert('수정 실패: ' + error.message)
    else setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: value || null } : r))
  }

  function EditableCell({ row, field, className = '' }: { row: PaperOrder; field: keyof PaperOrder; className?: string }) {
    const [value, setValue] = useState((row[field] as string) ?? '')
    return (
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { if (value !== ((row[field] as string) ?? '')) saveField(row, field, value) }}
        className={`w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-sm ${className}`}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 성함, 연락처..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">상태 전체</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter('') }}
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

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          {[
            { label: '상태', key: 'status' },
            { label: '상호명', key: 'business_name' },
            { label: '성함', key: 'owner_name' },
            { label: '연락처', key: 'phone' },
            { label: '주소', key: 'address' },
            { label: '택배', key: 'delivery_note' },
            { label: '요청일', key: 'requested_at' },
            { label: '발송일', key: 'shipped_at' },
            { label: '건수', key: 'count' },
            { label: '매출', key: 'revenue' },
            { label: '낱개기준(빨강)', key: 'unit_standard' },
            { label: '메모', key: 'memo' },
          ].map(({ label, key }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button type="submit" disabled={submitting}
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1400px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              {['상태', '상호명', '성함', '연락처', '주소', '택배', '요청일', '발송일', '건수', '매출', '낱개기준(빨강)', '메모'].map(label => (
                <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <select
                    value={row.status ?? ''}
                    onChange={e => saveField(row, 'status', e.target.value)}
                    className={`text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${STATUS_COLOR[row.status ?? ''] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    <option value="">-</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap min-w-[120px]">
                  <EditableCell row={row} field="business_name" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]">
                  <EditableCell row={row} field="owner_name" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[120px]">
                  <EditableCell row={row} field="phone" />
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[200px]">
                  <EditableCell row={row} field="address" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]">
                  <EditableCell row={row} field="delivery_note" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]">
                  <EditableCell row={row} field="requested_at" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[80px]">
                  <EditableCell row={row} field="shipped_at" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[60px]">
                  <EditableCell row={row} field="count" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[70px]">
                  <EditableCell row={row} field="revenue" />
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap min-w-[100px]">
                  <EditableCell row={row} field="unit_standard" />
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">
                  <EditableCell row={row} field="memo" />
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={13} className="text-center text-slate-400 py-10">데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
