'use client'

import { useState, useMemo, useEffect, useCallback, memo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPhone } from '@/lib/format'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Search, RefreshCw, Download, GripVertical, Trash2 } from 'lucide-react'
import type { Profile } from '@/types'
import { useToast } from '@/components/ui/Toast'

const STATUS_LABELS: Record<string, string> = {
  received: '접수',
  preparing: '제품준비',
  scheduled: '일정확정',
  in_transit: '이동중',
  delivery_sent: '택배발송',
  completed: '설치완료',
  rejected: '반려',
}
const STATUS_ORDER_INSTALL = ['received', 'preparing', 'scheduled', 'in_transit', 'completed']
const STATUS_ORDER_DELIVERY = ['received', 'preparing', 'delivery_sent', 'completed']
function statusOrderFor(deliveryType?: string) {
  return deliveryType === 'delivery' ? STATUS_ORDER_DELIVERY : STATUS_ORDER_INSTALL
}
// 예전에 만들어진 택배발송 건은 실제 status 값이 in_transit으로 저장돼 있으므로, 표시할 때만 보정한다
function statusLabel(status: string, deliveryType?: string) {
  if (status === 'in_transit' && deliveryType === 'delivery') return '택배발송'
  return STATUS_LABELS[status] ?? status
}
const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-100 text-gray-600 border-gray-200',
  preparing: 'bg-blue-50 text-blue-600 border-blue-200',
  scheduled: 'bg-purple-50 text-purple-600 border-purple-200',
  in_transit: 'bg-amber-50 text-amber-600 border-amber-200',
  delivery_sent: 'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-green-50 text-green-600 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}
const PRODUCT_CATALOG = ['포스기 1set', '포스기 본체', '영수증 프린터', '카드단말기', '기타']

interface Installation {
  id: string
  customer_name: string
  customer_phone?: string
  items: { name: string; quantity: number }[]
  status: string
  assigned_to?: string
  notes?: string
  completion_photo_urls?: string[]
  status_token: string
  created_by?: string
  created_at: string
  assignee?: { name: string } | null
  creator?: { name: string } | null
  franchise_application_id?: string
  address?: string
  delivery_type?: string
  scheduled_date?: string
  scheduled_time?: string
  sort_order?: number | null
}

interface Props {
  profile: Profile
  techUsers: { id: string; name: string }[]
  initialInstalls: Installation[]
  mineOnly?: boolean
}

const PAGE_SIZE = 10

const MAIN_COLUMNS = [
  { key: 'name', label: '고객명' },
  { key: 'phone', label: '전화번호' },
  { key: 'address', label: '주소' },
  { key: 'items', label: '제품' },
  { key: 'status', label: '상태' },
  { key: 'tech', label: '담당기사' },
  { key: 'notes', label: '비고' },
  { key: 'date', label: '등록일' },
  { key: 'actions', label: '' },
] as const
const DEFAULT_WIDTHS: Record<string, number> = {
  name: 140,
  phone: 120,
  address: 200,
  items: 160,
  status: 110,
  tech: 90,
  notes: 150,
  date: 100,
  actions: 80,
}
const COL_WIDTHS_STORAGE_KEY = 'installs_col_widths'

// --- Separate form component so typing here doesn't re-render the whole list ---
interface CreateFormProps {
  techUsers: { id: string; name: string }[]
  onSubmit: (v: {
    customerName: string
    customerPhone: string
    assignedTo: string
    notes: string
    items: { name: string; quantity: number }[]
    deliveryType: 'install' | 'delivery'
  }) => Promise<void>
  submitting: boolean
  onCancel: () => void
}
const CreateForm = memo(function CreateForm({ techUsers, onSubmit, submitting, onCancel }: CreateFormProps) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', assignedTo: '', notes: '' })
  const [deliveryType, setDeliveryType] = useState<'install' | 'delivery'>('install')
  const [cartProduct, setCartProduct] = useState(PRODUCT_CATALOG[0])
  const [cartQty, setCartQty] = useState(1)
  const [cartItems, setCartItems] = useState<{ name: string; quantity: number }[]>([])

  function addToCart() {
    setCartItems(prev => {
      const existing = prev.find(i => i.name === cartProduct)
      if (existing) return prev.map(i => i.name === cartProduct ? { ...i, quantity: i.quantity + cartQty } : i)
      return [...prev, { name: cartProduct, quantity: cartQty }]
    })
    setCartQty(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      assignedTo: form.assignedTo,
      notes: form.notes,
      items: cartItems,
      deliveryType,
    })
    setForm({ customerName: '', customerPhone: '', assignedTo: '', notes: '' })
    setDeliveryType('install')
    setCartItems([])
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-sm font-bold text-slate-800 mb-4">새 설치건 등록</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 설치/택배 구분 */}
        <div className="flex gap-2">
          {(['install', 'delivery'] as const).map(t => (
            <button key={t} type="button" onClick={() => setDeliveryType(t)}
              className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-colors ${deliveryType === t ? (t === 'install' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-500 text-white border-orange-500') : 'bg-white text-slate-500 border-slate-200'}`}>
              {t === 'install' ? '설치' : '택배발송'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">고객명 *</label>
            <input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className={INPUT} placeholder="홍길동" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">전화번호</label>
            <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: formatPhone(e.target.value) }))}
              className={INPUT} placeholder="01012345678" />
          </div>
          {techUsers.length > 0 && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">담당 기사</label>
              <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={INPUT}>
                <option value="">미배정</option>
                {techUsers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">비고</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">제품 추가</label>
            <div className="flex gap-2">
              <select value={cartProduct} onChange={e => setCartProduct(e.target.value)} className={INPUT}>
                {PRODUCT_CATALOG.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="number" min={1} value={cartQty} onChange={e => setCartQty(Number(e.target.value))}
                className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center" />
              <button type="button" onClick={addToCart}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">추가</button>
            </div>
            {cartItems.length > 0 && (
              <ul className="mt-2 space-y-1">
                {cartItems.map(it => (
                  <li key={it.name} className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span>{it.name} × {it.quantity}</span>
                    <button type="button" onClick={() => setCartItems(prev => prev.filter(i => i.name !== it.name))}
                      className="text-red-400 text-xs">삭제</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600">취소</button>
          <button type="submit" disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  )
})

const EditableInstallText = memo(function EditableInstallText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text !== value) onSave(text) }}
      onClick={e => e.stopPropagation()}
      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  )
})

const InstallItemsEditor = memo(function InstallItemsEditor({ items, onChange }: { items: { name: string; quantity: number }[]; onChange: (items: { name: string; quantity: number }[]) => void }) {
  const [product, setProduct] = useState(PRODUCT_CATALOG[0])
  const [qty, setQty] = useState(1)
  function add() {
    const existing = items.find(i => i.name === product)
    const next = existing
      ? items.map(i => i.name === product ? { ...i, quantity: i.quantity + qty } : i)
      : [...items, { name: product, quantity: qty }]
    onChange(next)
    setQty(1)
  }
  function remove(name: string) {
    onChange(items.filter(i => i.name !== name))
  }
  return (
    <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map(i => (
            <li key={i.name} className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded px-2 py-1">
              <span>{i.name} x{i.quantity}</span>
              <button type="button" onClick={() => remove(i.name)} className="text-slate-400 hover:text-red-500">✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <select value={product} onChange={e => setProduct(e.target.value)}
          className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none">
          {PRODUCT_CATALOG.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-14 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none" />
        <button type="button" onClick={add} className="px-2.5 py-1 bg-slate-800 text-white text-xs rounded hover:bg-slate-700">추가</button>
      </div>
    </div>
  )
})

export default function InstallsClient({ profile, techUsers, initialInstalls, mineOnly }: Props) {
  const canEdit = ['tech', 'cs', 'admin'].includes(profile.role)
  const toast = useToast()
  const [installs, setInstalls] = useState<Installation[]>(initialInstalls)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailInst, setDetailInst] = useState<Installation | null>(null)
  const [completeModal, setCompleteModal] = useState<{ id: string; notes: string } | null>(null)
  const [completePhotos, setCompletePhotos] = useState<File[]>([])
  const [completing, setCompleting] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [transitModal, setTransitModal] = useState<{ id: string; eta: string } | null>(null)
  const [sendingTransit, setSendingTransit] = useState(false)
  const [scheduleModal, setScheduleModal] = useState<{ id: string; date: string; time: string } | null>(null)
  const [sendingSchedule, setSendingSchedule] = useState(false)
  const [editingNotes, setEditingNotes] = useState<{ id: string; value: string } | null>(null)
  const [todayScheduled, setTodayScheduled] = useState<{ id: string; business_name?: string; owner_name?: string }[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [techFilter, setTechFilter] = useState(mineOnly ? profile.id : '')
  const [showRejected, setShowRejected] = useState(false)
  const [franchiseDetail, setFranchiseDetail] = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deliveryTab, setDeliveryTab] = useState<'all' | 'install' | 'delivery'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [checklistItems, setChecklistItems] = useState<{ label: string; checked: boolean }[]>([])
  const [showMonthlyStats, setShowMonthlyStats] = useState(false)
  const [skipNotify, setSkipNotify] = useState(false)
  const [rowDragId, setRowDragId] = useState<string | null>(null)
  const { colWidths, startResize } = useColumnWidths(COL_WIDTHS_STORAGE_KEY, DEFAULT_WIDTHS)

  const supabase = createClient()

  async function fetchInstalls() {
    setLoading(true)
    const { data } = await supabase
      .from('installations')
      .select('*, assignee:profiles!installations_assigned_to_fkey(name), creator:profiles!installations_created_by_fkey(name)')
      .order('sort_order', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(300)
    setInstalls((data as any) ?? [])
    setLoading(false)
  }

  async function openFranchiseDetail(franchiseId: string) {
    setLoadingDetail(true)
    setFranchiseDetail({})
    const { data } = await supabase
      .from('franchise_applications')
      .select('*, sales:profiles!franchise_applications_sales_id_fkey(name), cs:profiles!franchise_applications_cs_id_fkey(name)')
      .eq('id', franchiseId)
      .single()
    setFranchiseDetail(data ?? null)
    setLoadingDetail(false)
  }

  async function handleCreate(newInstall: {
    customerName: string
    customerPhone: string
    assignedTo: string
    notes: string
    items: { name: string; quantity: number }[]
    deliveryType: 'install' | 'delivery'
  }) {
    if (!newInstall.customerName) return
    setSubmitting(true)
    const { error } = await supabase.from('installations').insert({
      customer_name: newInstall.customerName,
      customer_phone: newInstall.customerPhone ? formatPhone(newInstall.customerPhone) : null,
      items: newInstall.items,
      assigned_to: newInstall.assignedTo || null,
      notes: newInstall.notes || null,
      created_by: profile.id,
      status: 'received',
      delivery_type: newInstall.deliveryType,
    })
    setSubmitting(false)
    if (error) { toast.error('등록 실패: ' + error.message); return }
    setShowForm(false)
    fetchInstalls()
  }

  async function sendInstallNotify(id: string, status: string, extra?: { eta?: string; scheduledDate?: string; scheduledTime?: string }) {
    const inst = installs.find(i => i.id === id)
    if (!inst?.customer_phone) return
    const notifyStatus = inst.delivery_type === 'delivery' && status === 'in_transit' ? 'delivery_sent' : status
    if (!['preparing', 'scheduled', 'in_transit', 'completed', 'delivery_sent'].includes(notifyStatus)) return
    try {
      const res = await fetch('/api/installs/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: inst.customer_phone,
          customerName: inst.customer_name,
          status: notifyStatus,
          eta: extra?.eta,
          scheduledDate: extra?.scheduledDate,
          scheduledTime: extra?.scheduledTime,
          statusToken: inst.status_token,
        }),
      })
      const data = await res.json()
      if (!data.ok) toast.error('알림톡 발송 실패: ' + data.error)
    } catch (e: any) {
      toast.error('알림톡 발송 실패: ' + (e?.message ?? '알 수 없는 오류'))
    }
  }

  async function handleStatusChange(id: string, status: string) {
    if (status === 'completed') {
      const inst = installs.find(i => i.id === id)
      setChecklistItems([
        { label: '전원 정상 확인', checked: false },
        { label: '영수증 프린터 테스트', checked: false },
        { label: '카드단말기 연결', checked: false },
        { label: '설치사진 촬영', checked: false },
        { label: '고객 서명/동의', checked: false },
      ])
      setCompleteModal({ id, notes: inst?.notes ?? '' })
      setCompletePhotos([])
      return
    }
    if (status === 'in_transit') {
      setTransitModal({ id, eta: '' })
      return
    }
    if (status === 'scheduled') {
      const inst = installs.find(i => i.id === id)
      setScheduleModal({ id, date: inst?.scheduled_date ?? '', time: inst?.scheduled_time ?? '' })
      return
    }
    await supabase.from('installations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (!skipNotify) await sendInstallNotify(id, status)
  }

  async function submitTransit(skipEta?: boolean, skipSend?: boolean) {
    if (!transitModal) return
    setSendingTransit(true)
    const { id, eta } = transitModal
    await supabase.from('installations').update({ status: 'in_transit', updated_at: new Date().toISOString() }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status: 'in_transit' } : i))
    const sendEta = skipEta ? undefined : (eta.trim() || undefined)
    setTransitModal(null)
    setSendingTransit(false)
    if (!skipNotify && !skipSend) await sendInstallNotify(id, 'in_transit', { eta: sendEta })
  }

  async function submitSchedule() {
    if (!scheduleModal) return
    const { id, date, time } = scheduleModal
    if (!date.trim() || !time.trim()) return
    setSendingSchedule(true)
    await supabase.from('installations').update({
      status: 'scheduled',
      scheduled_date: date,
      scheduled_time: time,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status: 'scheduled', scheduled_date: date, scheduled_time: time } : i))
    setScheduleModal(null)
    setSendingSchedule(false)
    if (!skipNotify) await sendInstallNotify(id, 'scheduled', { scheduledDate: date, scheduledTime: time })
  }

  async function submitReject() {
    if (!rejectModal) return
    setRejecting(true)
    const { id, reason } = rejectModal
    await supabase.from('installations').update({
      status: 'rejected',
      notes: reason || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status: 'rejected', notes: reason || i.notes } : i))
    setRejectModal(null)
    setRejecting(false)

    // 연결된 가맹접수 CS 담당자에게 알림 + 이관 로그 기록
    const inst = installs.find(i => i.id === id)
    if (inst?.franchise_application_id) {
      const { data: fa } = await supabase
        .from('franchise_applications')
        .select('cs_id, business_name, owner_name, status')
        .eq('id', inst.franchise_application_id)
        .single()

      const name = fa?.business_name || fa?.owner_name || '미입력'

      // 이관 로그에 반려 기록
      if (fa) {
        await supabase.from('franchise_application_logs').insert({
          franchise_application_id: inst.franchise_application_id,
          user_id: profile.id,
          from_status: fa.status,
          to_status: 'install_rejected',
        })
      }

      const notifyTargets: string[] = []
      if (fa?.cs_id) {
        notifyTargets.push(fa.cs_id)
      } else {
        const { data: csProfiles } = await supabase.from('profiles').select('id').eq('role', 'cs')
        csProfiles?.forEach(u => notifyTargets.push(u.id))
      }
      for (const uid of notifyTargets) {
        await supabase.from('notifications').insert({
          user_id: uid,
          franchise_application_id: inst.franchise_application_id,
          type: 'install_rejected',
          title: `[${name}] 기술지원 반려`,
          body: reason ? `반려 사유: ${reason}` : '기술지원팀에서 설치건을 반려했습니다. 가맹접수를 확인해주세요.',
        })
      }
    }
  }

  async function submitCompletion(skipCompleteSend?: boolean) {
    if (!completeModal) return
    if (completePhotos.length === 0) { toast.warning('설치완료사진을 최소 1장 첨부해주세요.'); return }
    setCompleting(true)
    const { id, notes } = completeModal

    const photoUrls: string[] = []
    for (const [i, file] of completePhotos.entries()) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${id}/${Date.now()}-${i}.${ext}`
      const { error: uploadError } = await supabase.storage.from('install-photos').upload(path, file)
      if (uploadError) { toast.error('사진 업로드 실패: ' + uploadError.message); setCompleting(false); return }
      const { data: { publicUrl } } = supabase.storage.from('install-photos').getPublicUrl(path)
      photoUrls.push(publicUrl)
    }

    const { error } = await supabase.from('installations').update({
      status: 'completed',
      notes: notes || null,
      completion_photo_urls: photoUrls,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error('완료 처리 실패: ' + error.message); setCompleting(false); return }

    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status: 'completed', notes, completion_photo_urls: photoUrls } : i))
    setCompleteModal(null)
    setCompletePhotos([])
    setCompleting(false)
    if (!skipNotify && !skipCompleteSend) await sendInstallNotify(id, 'completed')

    // 가맹이관 건이면 CS/영업에게 완료 알림 + 가맹접수 상태 업데이트 + 이관 로그
    const inst = installs.find(i => i.id === id)
    if (inst?.franchise_application_id) {
      const { data: fa } = await supabase
        .from('franchise_applications')
        .select('cs_id, sales_id, business_name, owner_name, status')
        .eq('id', inst.franchise_application_id)
        .single()
      const name = fa?.business_name || fa?.owner_name || '미입력'

      // 가맹접수 상태를 card_done으로 자동 업데이트 (이미 완료 상태가 아닌 경우)
      // 이 자동갱신은 updated_at을 건드리지 않아서(RPC), "최근 수정순" 목록에서 맨 위로 튀지 않는다
      if (fa && fa.status !== 'card_done') {
        await supabase.rpc('set_franchise_status_silent', { p_id: inst.franchise_application_id, p_status: 'card_done' })
        // 이관 로그 기록
        await supabase.from('franchise_application_logs').insert({
          franchise_application_id: inst.franchise_application_id,
          user_id: profile.id,
          from_status: fa.status,
          to_status: 'card_done',
        })
      }

      // CS/영업 완료 알림
      const notifyTargets = [...new Set([fa?.cs_id, fa?.sales_id].filter(Boolean) as string[])]
      for (const uid of notifyTargets) {
        await supabase.from('notifications').insert({
          user_id: uid,
          franchise_application_id: inst.franchise_application_id,
          type: 'install_completed',
          title: `[${name}] 설치완료`,
          body: '기술지원팀에서 설치를 완료했습니다. 가맹접수 상태가 카드가맹완료로 변경되었습니다.',
        })
      }
    }
  }

  async function saveNotes(id: string, notes: string) {
    const prev = installs.find(i => i.id === id)
    let saveValue = notes || null
    if (notes) {
      const stamp = `[${profile.name} ${new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}]`
      const prevNotes = (prev?.notes ?? '').trim()
      saveValue = prevNotes ? `${prevNotes}\n${stamp} ${notes}` : `${stamp} ${notes}`
    }
    await supabase.from('installations').update({ notes: saveValue }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, notes: saveValue ?? undefined } : i))
    setEditingNotes(null)
  }

  async function saveInstallField(id: string, field: 'customer_name' | 'customer_phone' | 'address' | 'delivery_type' | 'scheduled_date' | 'scheduled_time', value: string) {
    const saveValue = field === 'customer_phone' ? (value ? formatPhone(value) : null) : (value || null)
    const { error } = await supabase.from('installations').update({ [field]: saveValue }).eq('id', id)
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, [field]: saveValue ?? undefined } : i))
  }

  async function saveInstallItems(id: string, items: { name: string; quantity: number }[]) {
    const { error } = await supabase.from('installations').update({ items }).eq('id', id)
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, items } : i))
  }

  async function handleAssign(id: string, assignedTo: string) {
    const prev = installs.find(i => i.id === id)
    await supabase.from('installations').update({ assigned_to: assignedTo || null }).eq('id', id)
    if (assignedTo && assignedTo !== prev?.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: assignedTo,
        type: 'install_assigned',
        title: '설치 배정',
        body: `${prev?.customer_name ?? '고객'} 설치건이 배정되었습니다.`,
      })
    }
    fetchInstalls()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('installations').delete().eq('id', id)
    setInstalls(prev => prev.filter(i => i.id !== id))
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => {
      if (pagedInstalls.length > 0 && pagedInstalls.every(i => prev.has(i.id))) {
        const next = new Set(prev)
        pagedInstalls.forEach(i => next.delete(i.id))
        return next
      }
      return new Set([...prev, ...pagedInstalls.map(i => i.id)])
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeletingSelected(true)
    const ids = [...selected]
    const { error } = await supabase.from('installations').delete().in('id', ids)
    setDeletingSelected(false)
    if (error) { toast.error('삭제 실패: ' + error.message); return }
    setInstalls(prev => prev.filter(i => !selected.has(i.id)))
    setSelected(new Set())
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/install-status/${token}`
    navigator.clipboard.writeText(url)
    toast.success('고객 조회 링크가 복사됐습니다.')
  }

  function handleExcel() {
    import('xlsx').then(XLSX => {
      const rows = filteredInstalls.map(i => ({
        고객명: i.customer_name,
        전화번호: i.customer_phone ?? '',
        제품: i.items.map(it => `${it.name} x${it.quantity}`).join(', '),
        상태: statusLabel(i.status, i.delivery_type),
        담당자: (i.assignee as any)?.name ?? '',
        비고: i.notes ?? '',
        등록일: format(new Date(i.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '설치관리')
      XLSX.writeFile(wb, `설치관리_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    })
  }

  // 당일 설치 예정 체크 (하루 한 번)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const lastCheck = localStorage.getItem('install_schedule_check')
    if (lastCheck === today) return
    async function checkToday() {
      const { data } = await supabase
        .from('franchise_applications')
        .select('id, business_name, owner_name')
        .eq('install_date', today)
      if (data && data.length > 0) {
        setTodayScheduled(data)
        localStorage.setItem('install_schedule_check', today)
      }
    }
    checkToday()
  }, [])

  const assignCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const inst of installs) {
      if (inst.assigned_to && inst.status !== 'completed' && inst.status !== 'rejected') {
        counts[inst.assigned_to] = (counts[inst.assigned_to] ?? 0) + 1
      }
    }
    return counts
  }, [installs])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const i of installs) counts[i.status] = (counts[i.status] ?? 0) + 1
    return counts
  }, [installs])

  const techProfiles = useMemo(() => {
    const seen = new Set<string>()
    const list: { id: string; name: string }[] = []
    for (const i of installs) {
      const assignee = (i as unknown as { assignee?: { name?: string } }).assignee
      if (i.assigned_to && !seen.has(i.assigned_to)) {
        seen.add(i.assigned_to)
        list.push({ id: i.assigned_to, name: assignee?.name ?? i.assigned_to })
      }
    }
    return list
  }, [installs])

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {}
    for (const i of installs) {
      const m = i.created_at.slice(0, 7)
      if (!stats[m]) stats[m] = { total: 0, completed: 0 }
      stats[m].total++
      if (i.status === 'completed') stats[m].completed++
    }
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  }, [installs])

  const techStats = useMemo(() => {
    const stats: Record<string, { name: string; total: number; completed: number }> = {}
    for (const i of installs) {
      if (!i.assigned_to) continue
      if (!stats[i.assigned_to]) {
        const name = (i as any).assignee?.name ?? i.assigned_to
        stats[i.assigned_to] = { name, total: 0, completed: 0 }
      }
      stats[i.assigned_to].total++
      if (i.status === 'completed') stats[i.assigned_to].completed++
    }
    return Object.values(stats).sort((a, b) => b.completed - a.completed)
  }, [installs])

  const filteredInstalls = useMemo(() => {
    const q = search.trim().toLowerCase()
    return installs.filter(i => {
      if (deliveryTab === 'install' && (i as any).delivery_type === 'delivery') return false
      if (deliveryTab === 'delivery' && (i as any).delivery_type !== 'delivery') return false
      if (!showRejected && i.status === 'rejected') return false
      if (statusFilter && i.status !== statusFilter) return false
      if (techFilter && i.assigned_to !== techFilter) return false
      if (dateFrom && i.created_at < dateFrom) return false
      if (dateTo && i.created_at > dateTo + 'T23:59:59') return false
      if (q && !(
        i.customer_name?.toLowerCase().includes(q) ||
        i.customer_phone?.toLowerCase().includes(q) ||
        i.items?.some(it => it.name.toLowerCase().includes(q))
      )) return false
      return true
    })
  }, [installs, search, statusFilter, techFilter, showRejected, deliveryTab, dateFrom, dateTo])

  const canReorder = !search.trim() && !statusFilter && !techFilter && !dateFrom && !dateTo && deliveryTab === 'all' && !showRejected

  const reorderInstalls = useCallback((dragId: string, dropId: string) => {
    if (dragId === dropId) return
    const from = installs.findIndex(i => i.id === dragId)
    const to = installs.findIndex(i => i.id === dropId)
    if (from === -1 || to === -1) return
    const next = [...installs]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setInstalls(next)
    const n = next.length
    Promise.all(next.map((r, i) =>
      supabase.from('installations').update({ sort_order: (n - i) * 1000 }).eq('id', r.id)
    )).catch(() => toast.error('순서 저장에 실패했습니다.'))
  }, [installs, supabase, toast])

  const pagedInstalls = filteredInstalls.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filteredInstalls.length / PAGE_SIZE)

  const thisMonth = installs.filter(i => {
    const d = new Date(i.created_at)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* 당일 설치 예정 배너 */}
      {todayScheduled.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-amber-600 font-bold text-sm">오늘 설치 예정 {todayScheduled.length}건</span>
          <span className="text-amber-500 text-xs">{todayScheduled.map(f => f.business_name || f.owner_name || '미입력').join(' · ')}</span>
          <button onClick={() => setTodayScheduled([])} className="ml-auto text-amber-400 hover:text-amber-600 text-xs">닫기</button>
        </div>
      )}

      {/* 기사별 배정 현황 — 클릭 시 해당 기사 필터 적용 */}
      {!mineOnly && techUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {techUsers.map(t => (
            <button
              key={t.id}
              onClick={() => setTechFilter(prev => prev === t.id ? '' : t.id)}
              className={`text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 border transition-colors ${techFilter === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
            >
              <span>{t.name}</span>
              <span className={`font-bold ${techFilter === t.id ? 'text-blue-100' : 'text-blue-600'}`}>{assignCounts[t.id] ?? 0}건</span>
            </button>
          ))}
          {techFilter && (
            <button onClick={() => setTechFilter('')} className="text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 transition-colors">✕ 필터 해제</button>
          )}
        </div>
      )}

      {/* 가맹접수 상세 모달 */}
      {franchiseDetail !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFranchiseDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">가맹접수 원본 정보</h3>
              <button onClick={() => setFranchiseDetail(null)} aria-label="닫기" className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            {loadingDetail ? (
              <p className="text-sm text-slate-400 text-center py-8">불러오는 중...</p>
            ) : franchiseDetail && Object.keys(franchiseDetail).length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ['상호명', (franchiseDetail as any).business_name],
                  ['대표자', (franchiseDetail as any).owner_name],
                  ['연락처', (franchiseDetail as any).phone],
                  ['사업자번호', (franchiseDetail as any).business_number],
                  ['주소', (franchiseDetail as any).address],
                  ['상세주소', (franchiseDetail as any).address_detail],
                  ['오픈예정일', (franchiseDetail as any).open_date],
                  ['설치발송일', (franchiseDetail as any).install_date],
                  ['VAN사', (franchiseDetail as any).van_company],
                  ['인터넷', (franchiseDetail as any).internet],
                  ['담당영업', (franchiseDetail as any).sales?.name],
                  ['담당CS', (franchiseDetail as any).cs?.name],
                ].map(([label, value]) => value ? (
                  <div key={label as string}>
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-slate-800 break-words">{value as string}</p>
                  </div>
                ) : null)}
                {(franchiseDetail as any).equipment_items?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 font-medium">장비</p>
                    <p className="text-slate-800">{(franchiseDetail as any).equipment_items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}</p>
                  </div>
                )}
                {(franchiseDetail as any).memo && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 font-medium">비고</p>
                    <p className="text-slate-800 whitespace-pre-wrap">{(franchiseDetail as any).memo}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">정보를 불러올 수 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">반려 사유 입력</p>
            <textarea
              value={rejectModal.reason}
              onChange={e => setRejectModal(prev => prev ? { ...prev, reason: e.target.value } : prev)}
              placeholder="반려 사유를 입력하세요 (선택)"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={submitReject}
                disabled={rejecting}
                className="w-full py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >{rejecting ? '처리 중...' : '반려 확정'}</button>
              <button
                onClick={() => setRejectModal(null)}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600"
              >취소</button>
            </div>
          </div>
        </div>
      )}
      {/* 이동 예정 시각 입력 모달 */}
      {transitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">몇 시 방문 예정인가요?</p>
            <input
              type="time"
              value={transitModal.eta}
              onChange={e => setTransitModal(prev => prev ? { ...prev, eta: e.target.value } : prev)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-slate-400 -mt-2">※ 예정시각을 입력해야 알림톡이 발송됩니다.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => submitTransit(false)}
                disabled={sendingTransit}
                className="w-full py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >{sendingTransit ? '처리 중...' : '시각 기록하고 발송'}</button>
              <button
                onClick={() => submitTransit(true, true)}
                disabled={sendingTransit}
                className="w-full py-2 rounded-lg border border-slate-200 text-slate-400 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >{sendingTransit ? '처리 중...' : '템플릿 안보내고 변경'}</button>
              <button
                onClick={() => setTransitModal(null)}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600"
              >취소</button>
            </div>
          </div>
        </div>
      )}
      {/* 설치 일정 확정 안내 모달 */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">설치 일정을 확정하시나요?</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">설치 예정일</label>
              <input
                type="date"
                value={scheduleModal.date}
                onChange={e => setScheduleModal(prev => prev ? { ...prev, date: e.target.value } : prev)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">희망 시간대</label>
              <input
                type="time"
                value={scheduleModal.time}
                onChange={e => setScheduleModal(prev => prev ? { ...prev, time: e.target.value } : prev)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <p className="text-xs text-slate-400 -mt-2">※ 설치 예정일과 희망 시간대를 모두 입력해야 확정/발송할 수 있습니다.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => submitSchedule()}
                disabled={sendingSchedule || !scheduleModal.date.trim() || !scheduleModal.time.trim()}
                className="w-full py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
              >{sendingSchedule ? '처리 중...' : '일정 확정하고 발송'}</button>
              <button
                onClick={() => setScheduleModal(null)}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600"
              >취소</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{mineOnly ? '기사 페이지' : '설치 관리'}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {mineOnly ? `내 담당 건 ${installs.length}건` : `이번달 ${thisMonth}건 / 전체 ${installs.length}건`}
          </p>
        </div>
        <div className="flex gap-2">
          {profile.role === 'admin' && selected.size > 0 && (
            <button onClick={handleBulkDelete} disabled={deletingSelected}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-2 rounded-xl transition-colors">
              <Trash2 size={15} />
              {deletingSelected ? '삭제 중...' : `선택 삭제 (${selected.size})`}
            </button>
          )}
          {!mineOnly && (
            <button onClick={handleExcel} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
              <Download size={15} />엑셀
            </button>
          )}
          <button onClick={fetchInstalls} aria-label="새로고침" className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <RefreshCw size={15} />
          </button>
          {canEdit && !mineOnly && (
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 font-semibold">
              <Plus size={16} />새 설치건
            </button>
          )}
        </div>
      </div>

      {/* 등록 폼 */}
      {canEdit && !mineOnly && showForm && (
        <CreateForm techUsers={techUsers} onSubmit={handleCreate} submitting={submitting} onCancel={() => setShowForm(false)} />
      )}

      {/* 설치/택배 탭 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([['all', '전체'], ['install', '설치'], ['delivery', '택배발송']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => { setDeliveryTab(tab); setPage(1) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${deliveryTab === tab ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowMonthlyStats(v => !v)}
          className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
          {showMonthlyStats ? '실적 숨기기' : '기사별 월간 실적'}
        </button>
      </div>

      {/* 기사별 실적 + 월간 통계 */}
      {showMonthlyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">기사별 완료 실적 (누적)</p>
            <div className="space-y-2">
              {techStats.slice(0, 8).map((t, idx) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4">{idx + 1}</span>
                  <span className="text-sm text-slate-700 flex-1">{t.name}</span>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: `${t.total > 0 ? (t.completed / t.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-16 text-right">{t.completed}/{t.total}건</span>
                </div>
              ))}
              {techStats.length === 0 && <p className="text-xs text-slate-400">데이터 없음</p>}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">월별 실적 (최근 6개월)</p>
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1.5 pr-4 text-slate-400">월</th>
                  <th className="text-right py-1.5 pr-4 text-slate-400">총 건수</th>
                  <th className="text-right py-1.5 text-slate-400">완료</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map(([month, s]) => (
                  <tr key={month} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 font-medium text-slate-700">{month}</td>
                    <td className="py-1.5 pr-4 text-right text-slate-600">{s.total}건</td>
                    <td className="py-1.5 text-right text-green-600 font-medium">{s.completed}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 상태별 건수 */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_LABELS) as [string, string][]).map(([s, label]) => statusCounts[s] ? (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${statusFilter === s ? STATUS_COLORS[s as keyof typeof STATUS_COLORS] + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-white border-slate-200 text-slate-600'}`}>
            {label} {statusCounts[s]}
          </button>
        ) : null)}
        <button onClick={() => setShowRejected(v => !v)}
          className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${showRejected ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white border-slate-200 text-slate-400'}`}>
          {showRejected ? '반려건 포함' : '반려건 숨김'}
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="고객명, 전화번호, 제품명 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">상태 전체</option>
          {(Object.entries(STATUS_LABELS) as [string, string][]).map(([s, l]) => <option key={s} value={s}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" title="시작일" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" title="종료일" />
        {[
          { label: '오늘', fn: () => { const d = new Date().toISOString().slice(0,10); setDateFrom(d); setDateTo(d); setPage(1) } },
          { label: '이번주', fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); setDateFrom(mon.toISOString().slice(0,10)); setDateTo(sun.toISOString().slice(0,10)); setPage(1) } },
          { label: '이번달', fn: () => { const now = new Date(); const first = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; const last = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10); setDateFrom(first); setDateTo(last); setPage(1) } },
        ].map(({ label, fn }) => (
          <button key={label} onClick={fn} className="text-xs text-slate-500 border border-slate-200 rounded-xl px-2.5 py-2.5 hover:bg-slate-50 whitespace-nowrap">{label}</button>
        ))}
        {!mineOnly && (
          <select value={techFilter} onChange={e => { setTechFilter(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">기사 전체</option>
            {techProfiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(statusFilter || (!mineOnly && techFilter) || search || dateFrom || dateTo) && (
          <button onClick={() => { setStatusFilter(''); if (!mineOnly) setTechFilter(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-sm text-slate-400 hover:text-red-500 px-2 transition-colors">초기화</button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto whitespace-nowrap border border-slate-200 rounded-xl px-3 py-2.5 bg-white hover:bg-slate-50">
          <input type="checkbox" checked={skipNotify} onChange={e => setSkipNotify(e.target.checked)} className="w-3.5 h-3.5 accent-slate-600" />
          알림톡 건너뛰기
        </label>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filteredInstalls.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">설치건이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                {profile.role === 'admin' && <col style={{ width: 32 }} />}
                <col style={{ width: 24 }} />
                {MAIN_COLUMNS.map(col => (
                  <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 140 }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {profile.role === 'admin' && (
                    <th className="px-3 py-3">
                      <input type="checkbox"
                        checked={pagedInstalls.length > 0 && pagedInstalls.every(i => selected.has(i.id))}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-blue-600 cursor-pointer" />
                    </th>
                  )}
                  <th className="px-1 py-3" />
                  {MAIN_COLUMNS.map(col => (
                    <th key={col.key} title={col.label} className="relative px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis select-none">
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
                {pagedInstalls.map(inst => (
                <Fragment key={inst.id}>
                  <tr
                    className={`border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer ${rowDragId === inst.id ? 'opacity-40' : ''}`}
                    onClick={() => setDetailInst(prev => prev?.id === inst.id ? null : inst)}
                    onDragOver={e => { if (canReorder && rowDragId) e.preventDefault() }}
                    onDrop={e => { e.preventDefault(); if (rowDragId) reorderInstalls(rowDragId, inst.id) }}
                  >
                    {profile.role === 'admin' && (
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(inst.id)} onChange={() => toggleOne(inst.id)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer" />
                      </td>
                    )}
                    <td
                      className={`px-1 py-3 text-slate-700 ${canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30'}`}
                      draggable={canReorder}
                      onClick={e => e.stopPropagation()}
                      onDragStart={e => { if (!canReorder) { e.preventDefault(); return } setRowDragId(inst.id) }}
                      onDragEnd={() => setRowDragId(null)}
                      title={canReorder ? '드래그해서 순서 변경' : '검색/필터 중에는 순서를 변경할 수 없습니다'}
                    >
                      <GripVertical size={14} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
                      <div className="flex items-center gap-1.5">
                        <span>{inst.customer_name}</span>
                        {inst.franchise_application_id && (
                          <span className="text-[10px] font-semibold bg-purple-100 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-md">가맹이관</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">{inst.customer_phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-700 overflow-hidden">
                      {inst.address ? (
                        <span className="text-xs truncate block" title={inst.address}>{inst.address}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                      {inst.items?.length > 0 ? inst.items.map(i => `${i.name} x${i.quantity}`).join(', ') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <select value={inst.status} onChange={e => handleStatusChange(inst.id, e.target.value)}
                          className={`text-xs font-medium rounded-lg border px-2 py-1 focus:outline-none cursor-pointer ${STATUS_COLORS[inst.status]}`}>
                          {statusOrderFor(inst.delivery_type).map(s => <option key={s} value={s}>{statusLabel(s, inst.delivery_type)}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium rounded-lg border px-2 py-1 ${STATUS_COLORS[inst.status]}`}>
                          {statusLabel(inst.status, inst.delivery_type)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <select value={inst.assigned_to || ''} onChange={e => handleAssign(inst.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none">
                          <option value="">미배정</option>
                          {techUsers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-700">{inst.assignee?.name ?? '미배정'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px]" onClick={e => e.stopPropagation()}>
                      {canEdit && editingNotes?.id === inst.id ? (
                        <input autoFocus value={editingNotes.value}
                          onChange={e => setEditingNotes({ ...editingNotes, value: e.target.value })}
                          onBlur={() => saveNotes(inst.id, editingNotes.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveNotes(inst.id, editingNotes.value); if (e.key === 'Escape') setEditingNotes(null) }}
                          className="w-full text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none" />
                      ) : (
                        <span className={`text-xs line-clamp-1 ${canEdit ? 'cursor-pointer hover:text-blue-500' : ''}`}
                          onClick={() => canEdit && setEditingNotes({ id: inst.id, value: inst.notes ?? '' })}
                          title={canEdit ? '클릭하여 수정' : undefined}>
                          {inst.notes || (canEdit ? <span className="text-slate-500">비고 추가...</span> : '-')}
                        </span>
                      )}
                      {inst.completion_photo_urls && inst.completion_photo_urls.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {inst.completion_photo_urls.map(url => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="설치완료사진" className="w-8 h-8 object-cover rounded border border-slate-200" />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {format(new Date(inst.created_at), 'M/d HH:mm', { locale: ko })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {inst.franchise_application_id && (
                          <button onClick={() => openFranchiseDetail(inst.franchise_application_id!)}
                            className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50">가맹접수</button>
                        )}
                        <button onClick={() => copyLink(inst.status_token)}
                          className="text-xs text-slate-500 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50">링크</button>
                        {profile.role === 'tech' && inst.franchise_application_id && inst.status !== 'rejected' && inst.status !== 'completed' && (
                          <button onClick={() => setRejectModal({ id: inst.id, reason: '' })}
                            className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">반려</button>
                        )}
                        {(profile.role === 'admin') && (
                          <button onClick={() => handleDelete(inst.id)}
                            className="text-xs text-red-400 border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50">삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {detailInst?.id === inst.id && (
                    <tr className="bg-blue-50/50 border-b border-slate-100">
                      <td colSpan={(profile.role === 'admin' ? 1 : 0) + 1 + MAIN_COLUMNS.length} className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">고객명</p>
                            {canEdit ? (
                              <EditableInstallText value={inst.customer_name} onSave={v => saveInstallField(inst.id, 'customer_name', v)} />
                            ) : (
                              <p className="text-slate-800">{inst.customer_name}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">전화번호</p>
                            {canEdit ? (
                              <EditableInstallText value={inst.customer_phone ?? ''} onSave={v => saveInstallField(inst.id, 'customer_phone', v)} />
                            ) : (
                              <p className="text-slate-800">{inst.customer_phone ? formatPhone(inst.customer_phone) : '-'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">구분</p>
                            {canEdit ? (
                              <select
                                value={inst.delivery_type === 'delivery' ? 'delivery' : 'install'}
                                onClick={e => e.stopPropagation()}
                                onChange={e => saveInstallField(inst.id, 'delivery_type', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              >
                                <option value="install">설치</option>
                                <option value="delivery">택배발송</option>
                              </select>
                            ) : (
                              <p className="text-slate-800">{inst.delivery_type === 'delivery' ? '택배발송' : '설치'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">상태</p>
                            <p className="text-slate-800">{statusLabel(inst.status, inst.delivery_type)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-slate-400 mb-1">주소</p>
                            {canEdit ? (
                              <EditableInstallText value={inst.address ?? ''} onSave={v => saveInstallField(inst.id, 'address', v)} />
                            ) : (
                              <p className="text-slate-800 break-words">{inst.address || '-'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">담당기사</p>
                            <p className="text-slate-800">{inst.assignee?.name ?? '미배정'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">등록자</p>
                            <p className="text-slate-800">{inst.creator?.name ?? '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">설치 예정일</p>
                            {canEdit ? (
                              <input type="date" value={inst.scheduled_date ?? ''} onClick={e => e.stopPropagation()}
                                onChange={e => saveInstallField(inst.id, 'scheduled_date', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            ) : (
                              <p className="text-slate-800">{inst.scheduled_date || '-'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">희망 시간대</p>
                            {canEdit ? (
                              <input type="time" value={inst.scheduled_time ?? ''} onClick={e => e.stopPropagation()}
                                onChange={e => saveInstallField(inst.id, 'scheduled_time', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            ) : (
                              <p className="text-slate-800">{inst.scheduled_time || '-'}</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-slate-400 mb-1">제품</p>
                            {canEdit ? (
                              <InstallItemsEditor items={inst.items ?? []} onChange={items => saveInstallItems(inst.id, items)} />
                            ) : (
                              <p className="text-slate-800">{inst.items?.length > 0 ? inst.items.map(i => `${i.name} x${i.quantity}`).join(', ') : '-'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">등록일</p>
                            <p className="text-slate-800">{format(new Date(inst.created_at), 'yyyy-M-d HH:mm', { locale: ko })}</p>
                          </div>
                          <div className="col-span-4">
                            <p className="text-xs font-semibold text-slate-400">비고</p>
                            <p className="text-slate-800 whitespace-pre-wrap">{inst.notes || '-'}</p>
                          </div>
                          {inst.completion_photo_urls && inst.completion_photo_urls.length > 0 && (
                            <div className="col-span-4">
                              <p className="text-xs font-semibold text-slate-400 mb-1">설치완료 사진</p>
                              <div className="flex gap-2 flex-wrap">
                                {inst.completion_photo_urls.map(url => (
                                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="설치완료사진" className="w-20 h-20 object-cover rounded border border-slate-200" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {inst.franchise_application_id && (
                          <button
                            onClick={() => openFranchiseDetail(inst.franchise_application_id!)}
                            className="text-xs text-purple-600 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-50">
                            가맹접수 원본 보기
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex justify-center gap-3 py-4 border-t border-slate-100">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">이전</button>
                <span className="text-xs text-slate-400 flex items-center">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">다음</button>
              </div>
            )}
          </div>
        )}
      </div>

      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-800">설치 완료 처리</h3>
            {checklistItems.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-500 font-medium">완료 전 체크리스트</p>
                {checklistItems.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={item.checked}
                      onChange={() => setChecklistItems(prev => prev.map((c, j) => j === i ? { ...c, checked: !c.checked } : c))}
                      className="w-3.5 h-3.5 accent-green-600" />
                    <span className={item.checked ? 'line-through text-slate-400' : ''}>{item.label}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">설치완료사진 (필수, 여러 장 가능)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={e => setCompletePhotos(Array.from(e.target.files ?? []))}
                className="text-sm"
              />
              {completePhotos.length > 0 && (
                <p className="text-xs text-slate-500">{completePhotos.length}장 선택됨</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">비고</label>
              <textarea
                value={completeModal.notes}
                onChange={e => setCompleteModal(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                placeholder="현장 비고를 남겨주세요"
                rows={3}
                className={INPUT + ' resize-none'}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => submitCompletion(false)}
                disabled={completing || completePhotos.length === 0}
                className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >{completing ? '처리 중...' : '완료 처리'}</button>
              <button
                onClick={() => submitCompletion(true)}
                disabled={completing || completePhotos.length === 0}
                className="w-full py-2 rounded-lg border border-slate-200 text-slate-400 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >{completing ? '처리 중...' : '템플릿 안보내고 완료 처리'}</button>
              <button
                onClick={() => { setCompleteModal(null); setCompletePhotos([]) }}
                disabled={completing}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600"
              >취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
