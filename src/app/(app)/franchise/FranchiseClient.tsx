'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFranchiseRows } from './actions'
import type { ApplicantType, FranchiseApplication, FranchiseStatus, Profile } from '@/types'
import { APPLICANT_TYPE_LABEL, FRANCHISE_STATUS_LABEL, FRANCHISE_STATUS_COLOR } from '@/types'

const RECEPTION_CHANNELS = ['전화', '카카오톡', '문자', '방문', '온라인', '기타']

interface Props {
  rows: FranchiseApplication[]
  salesProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
}

const EMPTY_FORM = {
  business_name: '',
  owner_name: '',
  phone: '',
  business_number: '',
  equipment: '',
  address: '',
  address_detail: '',
  title: '',
  sales_id: '',
  applicant_type: 'individual' as ApplicantType,
  reception_channel: '',
  open_date: '',
  install_date: '',
  memo: '',
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
  const [form, setForm] = useState(EMPTY_FORM)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').insert({
      business_name: form.business_name || null,
      owner_name: form.owner_name || null,
      phone: form.phone || null,
      business_number: form.business_number || null,
      equipment: form.equipment || null,
      address: form.address || null,
      address_detail: form.address_detail || null,
      title: form.title || null,
      sales_id: form.sales_id || null,
      applicant_type: form.applicant_type,
      reception_channel: form.reception_channel || null,
      open_date: form.open_date || null,
      install_date: form.install_date || null,
      memo: form.memo || null,
    })
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setForm(EMPTY_FORM)
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function updateStatus(row: FranchiseApplication, status: FranchiseStatus) {
    setBusyId(row.id)
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'doc_waiting') patch.doc_template = APPLICANT_TYPE_LABEL[row.applicant_type]
    const { error } = await supabase.from('franchise_applications').update(patch).eq('id', row.id)
    if (error) { setBusyId(null); alert('상태 변경 실패: ' + error.message); return }

    if (status === 'doc_waiting') {
      await notify({ type: 'doc_request', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, applicantType: row.applicant_type })
    } else if (status === 'doc_incomplete' || status === 'doc_complete' || status === 'franchise_done') {
      await notify({ type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status })
    }
    setBusyId(null)
    startTransition(() => router.refresh())
  }

  async function updateApplicantType(row: FranchiseApplication, applicantType: ApplicantType) {
    if (applicantType === row.applicant_type) return
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ applicant_type: applicantType }).eq('id', row.id)
    if (error) { alert('사업자 유형 변경 실패: ' + error.message); return }
    startTransition(() => router.refresh())
  }

  async function saveField(row: FranchiseApplication, field: keyof FranchiseApplication, value: string) {
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ [field]: value || null }).eq('id', row.id)
    if (error) alert('수정 실패: ' + error.message)
    startTransition(() => router.refresh())
  }

  function handleStatusChange(row: FranchiseApplication, newStatus: FranchiseStatus) {
    if (newStatus === row.status) return

    const sendsMessage = newStatus === 'doc_waiting' || newStatus === 'doc_incomplete' || newStatus === 'doc_complete' || newStatus === 'franchise_done'
    if (sendsMessage && (!row.phone || !row.owner_name || !row.business_name)) {
      alert('연락처·대표자명·상호명이 모두 입력되어야 메시지를 보낼 수 있습니다. 먼저 입력해주세요.')
      return
    }

    const confirmMsg = newStatus === 'doc_waiting'
      ? `'${APPLICANT_TYPE_LABEL[row.applicant_type]}' 서류 안내 메시지가 고객에게 발송됩니다. 사업자 유형이 맞는지 확인 후 진행하세요. 변경하시겠습니까?`
      : `'${FRANCHISE_STATUS_LABEL[newStatus]}'(으)로 변경하면 고객에게 메시지가 발송됩니다. 변경하시겠습니까?`
    if (!confirm(confirmMsg)) return
    updateStatus(row, newStatus)
  }

  function EditableText({ row, field, placeholder, type = 'text' }: { row: FranchiseApplication; field: keyof FranchiseApplication; placeholder: string; type?: string }) {
    const [value, setValue] = useState((row[field] as string) ?? '')
    return (
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { if (value !== ((row[field] as string) ?? '')) saveField(row, field, value) }}
        onClick={e => e.stopPropagation()}
        className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
      />
    )
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
            <label className="text-xs font-medium text-slate-500">상호명</label>
            <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">대표자명</label>
            <input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">연락처</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">사업자번호</label>
            <input value={form.business_number} onChange={e => setForm({ ...form, business_number: e.target.value })} placeholder="000-00-00000"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">출고 장비</label>
            <input value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">주소</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">상세주소</label>
            <input value={form.address_detail} onChange={e => setForm({ ...form, address_detail: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">작업제목</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">담당 영업</label>
            <select value={form.sales_id} onChange={e => setForm({ ...form, sales_id: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {salesProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">사업자 유형</label>
            <select value={form.applicant_type} onChange={e => setForm({ ...form, applicant_type: e.target.value as ApplicantType })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(Object.keys(APPLICANT_TYPE_LABEL) as ApplicantType[]).map(t => (
                <option key={t} value={t}>{APPLICANT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">접수채널</label>
            <select value={form.reception_channel} onChange={e => setForm({ ...form, reception_channel: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">오픈예정일</label>
            <input type="date" value={form.open_date} onChange={e => setForm({ ...form, open_date: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">설치 및 발송일</label>
            <input type="date" value={form.install_date} onChange={e => setForm({ ...form, install_date: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">비고</label>
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
              <th className="px-3 py-2.5 border-b border-slate-200 w-6" />
              {['상호명', '대표자', '연락처', '담당영업', '사업자유형', '상태', '메모'].map(label => (
                <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localRows.map(row => (
              <>
                <tr key={row.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer ${busyId === row.id ? 'opacity-60' : ''}`}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {expandedId === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{row.business_name || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.owner_name || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.sales?.name ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select
                      value={row.applicant_type}
                      onChange={e => updateApplicantType(row, e.target.value as ApplicantType)}
                      className="text-xs font-medium rounded-full pl-2.5 pr-1.5 py-1 border-0 bg-slate-100 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                    >
                      {(Object.keys(APPLICANT_TYPE_LABEL) as ApplicantType[]).map(t => (
                        <option key={t} value={t}>{APPLICANT_TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
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
                  <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{row.memo || '-'}</td>
                </tr>
                {expandedId === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-blue-50/50 border-b border-slate-100">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400">사업자번호</label>
                          <EditableText row={row} field="business_number" placeholder="000-00-00000" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">출고 장비</label>
                          <EditableText row={row} field="equipment" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">작업제목</label>
                          <EditableText row={row} field="title" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">접수채널</label>
                          <select
                            value={row.reception_channel ?? ''}
                            onChange={e => saveField(row, 'reception_channel', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
                          >
                            <option value="">-</option>
                            {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-400">주소</label>
                          <EditableText row={row} field="address" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">상세주소</label>
                          <EditableText row={row} field="address_detail" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">오픈예정일</label>
                          <EditableText row={row} field="open_date" placeholder="-" type="date" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">설치 및 발송일</label>
                          <EditableText row={row} field="install_date" placeholder="-" type="date" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {localRows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10">등록된 가맹 접수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
