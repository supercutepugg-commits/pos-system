'use client'

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteFranchiseRows } from './actions'
import type { ApplicantType, EquipmentItem, FranchiseApplication, FranchiseApplicationLog, FranchiseStatus, Profile } from '@/types'
import { APPLICANT_TYPE_LABEL, FRANCHISE_STATUS_LABEL, FRANCHISE_STATUS_COLOR } from '@/types'

const RECEPTION_CHANNELS = ['전화', '카카오톡', '문자', '방문', '온라인', '기타']
const EQUIPMENT_CATALOG = ['토스프론트', '포스기', '인터넷', '키오스크', '영수증프린터', '키오스크리더기', '무선단말기', '금전함', '태블릿', '테이블오더']

interface Props {
  rows: FranchiseApplication[]
  salesProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  csProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  currentUserId: string
  initialStatusFilter?: string
}

const EMPTY_FORM = {
  business_name: '',
  owner_name: '',
  phone: '',
  business_number: '',
  equipmentItems: [] as EquipmentItem[],
  address: '',
  address_detail: '',
  title: '',
  sales_id: '',
  cs_id: '',
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

function EquipmentCart({ items, onChange }: { items: EquipmentItem[]; onChange: (items: EquipmentItem[]) => void }) {
  const [product, setProduct] = useState(EQUIPMENT_CATALOG[0])
  const [qty, setQty] = useState(1)

  function add() {
    const existing = items.find(i => i.name === product)
    if (existing) onChange(items.map(i => i.name === product ? { ...i, quantity: i.quantity + qty } : i))
    else onChange([...items, { name: product, quantity: qty }])
    setQty(1)
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <div className="flex gap-1.5">
        <select value={product} onChange={e => setProduct(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {EQUIPMENT_CATALOG.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
          className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center" />
        <button type="button" onClick={add}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">추가</button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map(it => (
            <li key={it.name} className="flex justify-between items-center bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
              <span>{it.name} × {it.quantity}</span>
              <button type="button" onClick={() => onChange(items.filter(i => i.name !== it.name))}
                className="text-red-400 hover:text-red-600">삭제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FranchiseClient({ rows, salesProfiles, csProfiles, currentUserId, initialStatusFilter = '' }: Props) {
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
  const [logsByRow, setLogsByRow] = useState<Record<string, FranchiseApplicationLog[]>>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [applicantTypeFilter, setApplicantTypeFilter] = useState('')
  const [salesFilter, setSalesFilter] = useState('')

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

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localRows.filter(row => {
      if (statusFilter && row.status !== statusFilter) return false
      if (applicantTypeFilter && row.applicant_type !== applicantTypeFilter) return false
      if (salesFilter && row.sales_id !== salesFilter) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [localRows, search, statusFilter, applicantTypeFilter, salesFilter])

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
      equipment_items: form.equipmentItems,
      address: form.address || null,
      address_detail: form.address_detail || null,
      title: form.title || null,
      sales_id: form.sales_id || null,
      cs_id: form.cs_id || null,
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

  async function createLinkedInstallTicket(row: FranchiseApplication) {
    if (!row.business_name || !row.owner_name || !row.phone || !row.address) {
      alert('가맹완료로 처리되었지만, 상호명·대표자명·연락처·주소가 모두 입력되지 않아 설치 작업을 자동으로 만들지 못했습니다. 가맹점/작업을 직접 등록해주세요.')
      return
    }
    const supabase = createClient()
    const { data: merchant, error: merchantError } = await supabase.from('merchants').insert({
      business_name: row.business_name,
      owner_name: row.owner_name,
      business_number: row.business_number || null,
      phone: row.phone,
      address: row.address,
      address_detail: row.address_detail || null,
      pos_model: row.equipment_items?.length ? row.equipment_items.map(i => `${i.name} x${i.quantity}`).join(', ') : null,
      sales_id: row.sales_id || null,
      memo: row.memo || null,
    }).select('id').single()

    if (merchantError || !merchant) {
      alert('가맹완료로 처리되었지만, 가맹점 자동 등록에 실패했습니다: ' + merchantError?.message)
      return
    }

    const { error: ticketError } = await supabase.from('tickets').insert({
      merchant_id: merchant.id,
      title: row.title || `${row.business_name} 가맹 설치`,
      type: 'install',
      status: 'tech_pending',
      sales_id: row.sales_id || null,
      cs_id: row.cs_id || null,
      memo: row.memo || null,
      reception_channel: row.reception_channel || null,
      open_date: row.open_date || null,
      install_date: row.install_date || null,
    })

    if (ticketError) {
      alert('가맹점은 등록됐지만 설치 작업 생성에 실패했습니다: ' + ticketError.message)
      return
    }
  }

  async function updateStatus(row: FranchiseApplication, status: FranchiseStatus) {
    setBusyId(row.id)
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'doc_waiting') patch.doc_template = APPLICANT_TYPE_LABEL[row.applicant_type]
    const { error } = await supabase.from('franchise_applications').update(patch).eq('id', row.id)
    if (error) { setBusyId(null); alert('상태 변경 실패: ' + error.message); return }

    await supabase.from('franchise_application_logs').insert({
      franchise_application_id: row.id,
      user_id: currentUserId,
      from_status: row.status,
      to_status: status,
    })

    if (status === 'doc_waiting') {
      await notify({ type: 'doc_request', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, applicantType: row.applicant_type })
    } else if (status === 'doc_incomplete' || status === 'doc_complete') {
      await notify({ type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status })
    } else if (status === 'franchise_done') {
      await notify({ type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status })
      await createLinkedInstallTicket(row)
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

  async function updateCs(row: FranchiseApplication, csId: string) {
    if (csId === (row.cs_id ?? '')) return
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ cs_id: csId || null }).eq('id', row.id)
    if (error) { alert('담당 CS 변경 실패: ' + error.message); return }
    startTransition(() => router.refresh())
  }

  async function saveField(row: FranchiseApplication, field: keyof FranchiseApplication, value: string) {
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ [field]: value || null }).eq('id', row.id)
    if (error) alert('수정 실패: ' + error.message)
    startTransition(() => router.refresh())
  }

  async function saveEquipmentItems(row: FranchiseApplication, items: EquipmentItem[]) {
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ equipment_items: items }).eq('id', row.id)
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
      : newStatus === 'franchise_done'
        ? `가맹완료로 변경하면 고객에게 메시지가 발송되고, 입력된 정보로 설치 작업이 자동 생성됩니다. 변경하시겠습니까?`
        : `'${FRANCHISE_STATUS_LABEL[newStatus]}'(으)로 변경하면 고객에게 메시지가 발송됩니다. 변경하시겠습니까?`
    if (!confirm(confirmMsg)) return
    updateStatus(row, newStatus)
  }

  async function toggleExpand(row: FranchiseApplication) {
    const next = expandedId === row.id ? null : row.id
    setExpandedId(next)
    if (next && !logsByRow[row.id]) {
      const supabase = createClient()
      const { data } = await supabase
        .from('franchise_application_logs')
        .select('*, user:profiles(name)')
        .eq('franchise_application_id', row.id)
        .order('created_at', { ascending: false })
      setLogsByRow(prev => ({ ...prev, [row.id]: data ?? [] }))
    }
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
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 대표자, 연락처..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">상태 전체</option>
          {(Object.keys(FRANCHISE_STATUS_LABEL) as FranchiseStatus[]).map(s => (
            <option key={s} value={s}>{FRANCHISE_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={applicantTypeFilter} onChange={e => setApplicantTypeFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">사업자유형 전체</option>
          {(Object.keys(APPLICANT_TYPE_LABEL) as ApplicantType[]).map(t => (
            <option key={t} value={t}>{APPLICANT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select value={salesFilter} onChange={e => setSalesFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">담당영업 전체</option>
          {salesProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search || statusFilter || applicantTypeFilter || salesFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setApplicantTypeFilter(''); setSalesFilter('') }}
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
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-medium text-slate-500">출고 장비</label>
            <EquipmentCart items={form.equipmentItems} onChange={items => setForm({ ...form, equipmentItems: items })} />
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
            <label className="text-xs font-medium text-slate-500">담당 CS</label>
            <select value={form.cs_id} onChange={e => setForm({ ...form, cs_id: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">선택 안함</option>
              {csProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
        <table className="w-full text-sm border-collapse min-w-[1250px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-slate-200 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              <th className="px-3 py-2.5 border-b border-slate-200 w-6" />
              {['상호명', '대표자', '연락처', '담당영업', '담당CS', '사업자유형', '상태', '메모'].map(label => (
                <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <>
                <tr key={row.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer ${busyId === row.id ? 'opacity-60' : ''}`}
                  onClick={() => toggleExpand(row)}>
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
                      value={row.cs_id ?? ''}
                      onChange={e => updateCs(row, e.target.value)}
                      className="text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded cursor-pointer"
                    >
                      <option value="">미지정</option>
                      {csProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
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
                    <td colSpan={10} className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400">사업자번호</label>
                          <EditableText row={row} field="business_number" placeholder="000-00-00000" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-400">출고 장비</label>
                          <EquipmentCart items={row.equipment_items ?? []} onChange={items => saveEquipmentItems(row, items)} />
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
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-1.5">상태 변경 이력</p>
                        {!logsByRow[row.id] ? (
                          <p className="text-xs text-slate-400">불러오는 중...</p>
                        ) : logsByRow[row.id].length === 0 ? (
                          <p className="text-xs text-slate-400">변경 이력이 없습니다.</p>
                        ) : (
                          <ul className="space-y-1">
                            {logsByRow[row.id].map(log => (
                              <li key={log.id} className="text-xs text-slate-500">
                                {new Date(log.created_at).toLocaleString('ko-KR')} · {log.user?.name ?? '알수없음'} ·{' '}
                                {log.from_status ? FRANCHISE_STATUS_LABEL[log.from_status as FranchiseStatus] ?? log.from_status : '-'} →{' '}
                                {log.to_status ? FRANCHISE_STATUS_LABEL[log.to_status as FranchiseStatus] ?? log.to_status : '-'}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={10} className="text-center text-slate-400 py-10">조건에 맞는 가맹 접수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
