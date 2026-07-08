'use client'

import { useState, useTransition, useMemo } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPhone } from '@/lib/format'
import { deleteChangeRequests } from './actions'
import type { ChangeRequest, ChangeRequestStatus, ChangeType, Profile } from '@/types'
import { CHANGE_TYPE_LABEL, CHANGE_STATUS_LABEL, CHANGE_STATUS_COLOR } from '@/types'
import { useToast } from '@/components/ui/Toast'

const CHANGE_TYPE_TABS: { key: ChangeType | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'bank', label: '통장변경' },
  { key: 'name', label: '상호변경' },
  { key: 'ceo', label: '대표자변경' },
  { key: 'address', label: '주소변경' },
  { key: 'category', label: '업종변경' },
]

const STATUS_OPTIONS: ChangeRequestStatus[] = ['pending', 'processing', 'done']

const EMPTY_FORM = {
  business_name: '',
  phone: '',
  change_type: 'bank' as ChangeType,
  before_value: '',
  after_value: '',
  sales_id: '',
  cs_id: '',
  memo: '',
}

interface Props {
  rows: ChangeRequest[]
  salesProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  csProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  currentUserId: string
  currentUserRole: string
}

export default function ChangesClient({ rows, salesProfiles, csProfiles, currentUserId, currentUserRole }: Props) {
  const [tab, setTab] = useState<ChangeType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const supabase = createClient()

  const canDelete = currentUserRole === 'admin' || currentUserRole === 'cs'

  const filtered = useMemo(
    () => (tab === 'all' ? rows : rows.filter(r => r.change_type === tab)),
    [rows, tab]
  )

  async function handleCreate() {
    if (!form.business_name.trim()) {
      toast.error('상호명을 입력해주세요.')
      return
    }
    const { error } = await supabase.from('change_requests').insert({
      business_name: form.business_name.trim(),
      phone: form.phone.trim() || null,
      change_type: form.change_type,
      before_value: form.before_value.trim() || null,
      after_value: form.after_value.trim() || null,
      sales_id: form.sales_id || null,
      cs_id: form.cs_id || null,
      memo: form.memo.trim() || null,
      created_by: currentUserId,
    })
    if (error) {
      toast.error(`등록 실패: ${error.message}`)
      return
    }
    toast.success('변경 요청이 등록되었습니다.')
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  async function handleStatusChange(row: ChangeRequest, status: ChangeRequestStatus) {
    const { error } = await supabase.from('change_requests').update({ status }).eq('id', row.id)
    if (error) toast.error(`변경 실패: ${error.message}`)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`${selected.size}건을 삭제하시겠습니까?`)) return
    startTransition(async () => {
      const { error } = await deleteChangeRequests([...selected])
      if (error) {
        toast.error(`삭제 실패: ${error}`)
        return
      }
      toast.success('삭제되었습니다.')
      setSelected(new Set())
    })
  }

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {CHANGE_TYPE_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {canDelete && selected.size > 0 && (
            <button onClick={handleDeleteSelected} disabled={isPending}
              className="flex items-center gap-1.5 text-red-600 text-sm px-3 py-2 rounded-lg hover:bg-red-50 font-semibold">
              <Trash2 size={16} />선택 삭제 ({selected.size})
            </button>
          )}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-blue-200">
            <Plus size={16} />변경 요청 등록
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-slate-500 text-xs">
              <th className="p-3 w-8"></th>
              <th className="p-3">유형</th>
              <th className="p-3">상호명</th>
              <th className="p-3">연락처</th>
              <th className="p-3">변경 전</th>
              <th className="p-3">변경 후</th>
              <th className="p-3">담당(영업/CS)</th>
              <th className="p-3">상태</th>
              <th className="p-3">등록일</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 p-8">등록된 변경 요청이 없습니다.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                </td>
                <td className="p-3 font-medium">{CHANGE_TYPE_LABEL[row.change_type]}</td>
                <td className="p-3">{row.business_name}</td>
                <td className="p-3 text-slate-500">{row.phone ? formatPhone(row.phone) : '-'}</td>
                <td className="p-3 text-slate-500 max-w-[160px] truncate">{row.before_value || '-'}</td>
                <td className="p-3 text-slate-500 max-w-[160px] truncate">{row.after_value || '-'}</td>
                <td className="p-3 text-slate-500">{row.sales?.name ?? '-'} / {row.cs?.name ?? '-'}</td>
                <td className="p-3">
                  <select value={row.status} onChange={e => handleStatusChange(row, e.target.value as ChangeRequestStatus)}
                    className={`text-xs px-2 py-1 rounded-md font-medium border-0 ${CHANGE_STATUS_COLOR[row.status]}`}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{CHANGE_STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
                <td className="p-3 text-slate-400 text-xs">{row.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">변경 요청 등록</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <select value={form.change_type} onChange={e => setForm({ ...form, change_type: e.target.value as ChangeType })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {(Object.keys(CHANGE_TYPE_LABEL) as ChangeType[]).map(t => (
                  <option key={t} value={t}>{CHANGE_TYPE_LABEL[t]}</option>
                ))}
              </select>
              <input placeholder="상호명" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="연락처" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="변경 전" value={form.before_value} onChange={e => setForm({ ...form, before_value: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="변경 후" value={form.after_value} onChange={e => setForm({ ...form, after_value: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <select value={form.sales_id} onChange={e => setForm({ ...form, sales_id: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">담당 영업 선택</option>
                {salesProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={form.cs_id} onChange={e => setForm({ ...form, cs_id: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">담당 CS 선택</option>
                {csProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <textarea placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              <button onClick={handleCreate}
                className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 font-semibold mt-1">
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
