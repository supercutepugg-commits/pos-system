'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFranchiseRows } from './actions'
import type { FranchiseApplication, FranchiseStatus, Profile } from '@/types'
import { FRANCHISE_STATUS_LABEL, FRANCHISE_STATUS_COLOR } from '@/types'

interface Props {
  rows: FranchiseApplication[]
  salesProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
}

async function notify(payload: Record<string, unknown>) {
  try {
    const res = await fetch('/api/franchise/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('가맹 알림톡 발송 실패:', json.error)
      alert('상태는 변경되었지만 알림톡 발송에 실패했습니다. 고객에게 직접 안내해주세요.')
    }
  } catch (err) {
    console.error('가맹 알림톡 발송 실패:', err)
    alert('상태는 변경되었지만 알림톡 발송에 실패했습니다. 고객에게 직접 안내해주세요.')
  }
}

export default function FranchiseClient({ rows, salesProfiles }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ business_name: '', owner_name: '', phone: '', sales_id: '', memo: '' })
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setLocalRows(rows)
    setSelected(new Set())
  }, [rows])

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('franchise_applications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'franchise_applications' }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => startTransition(() => router.refresh()), 400)
      })
      .subscribe()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  const allChecked = localRows.length > 0 && selected.size === localRows.length
  function toggleAll() { setSelected(allChecked ? new Set() : new Set(localRows.map(r => r.id))) }
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
    const { error } = await deleteFranchiseRows([...selected])
    setDeleting(false)
    if (error) { alert('삭제 실패: ' + error); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.business_name || !form.owner_name || !form.phone) {
      alert('상호명, 대표자명, 연락처는 필수입니다.')
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').insert({
      business_name: form.business_name,
      owner_name: form.owner_name,
      phone: form.phone,
      sales_id: form.sales_id || null,
      memo: form.memo || null,
    })
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setForm({ business_name: '', owner_name: '', phone: '', sales_id: '', memo: '' })
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function updateStatus(row: FranchiseApplication, status: FranchiseStatus, docTemplate?: string) {
    setBusyId(row.id)
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (docTemplate !== undefined) patch.doc_template = docTemplate
    const { error } = await supabase.from('franchise_applications').update(patch).eq('id', row.id)
    if (error) { setBusyId(null); alert('상태 변경 실패: ' + error.message); return }

    if (status === 'doc_waiting') {
      await notify({ type: 'doc_request', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, docTemplate })
    } else if (status === 'doc_incomplete' || status === 'doc_complete' || status === 'franchise_done') {
      await notify({ type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status })
    }
    setBusyId(null)
    startTransition(() => router.refresh())
  }

  function handleStatusChange(row: FranchiseApplication, newStatus: FranchiseStatus) {
    if (newStatus === row.status) return

    let docTemplate: string | undefined
    if (newStatus === 'doc_waiting') {
      const input = prompt('발송할 가맹 서류 템플릿명을 입력하세요 (예: 표준 가맹 서류 템플릿)', row.doc_template ?? '')
      if (input === null) return
      docTemplate = input
    }

    if (!confirm(`'${FRANCHISE_STATUS_LABEL[newStatus]}'(으)로 변경하면 고객에게 메시지가 발송됩니다. 변경하시겠습니까?`)) return
    updateStatus(row, newStatus, docTemplate)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">전체 {localRows.length.toLocaleString()}건</div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />
            정보 입력
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">상호명 *</label>
            <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">대표자명 *</label>
            <input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">연락처 *</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">담당 영업</label>
            <select value={form.sales_id} onChange={e => setForm({ ...form, sales_id: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {salesProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">메모</label>
            <input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={submitting}
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1100px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              {['상호명', '대표자', '연락처', '담당영업', '상태', '서류템플릿', '메모'].map(label => (
                <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localRows.map(row => (
              <tr key={row.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${busyId === row.id ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                </td>
                <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{row.business_name}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.owner_name}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.phone}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.sales?.name ?? '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <select
                    value={row.status}
                    disabled={busyId === row.id}
                    onChange={e => handleStatusChange(row, e.target.value as FranchiseStatus)}
                    className={`text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer disabled:opacity-50 ${FRANCHISE_STATUS_COLOR[row.status]}`}
                  >
                    {(Object.keys(FRANCHISE_STATUS_LABEL) as FranchiseStatus[]).map(s => (
                      <option key={s} value={s}>{FRANCHISE_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{row.doc_template ?? '-'}</td>
                <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{row.memo ?? '-'}</td>
              </tr>
            ))}
            {localRows.length === 0 && (
              <tr><td colSpan={8} className="text-center text-slate-400 py-10">등록된 가맹 접수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
