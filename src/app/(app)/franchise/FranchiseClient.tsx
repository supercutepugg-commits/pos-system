'use client'

import { useState, useTransition, useEffect, useRef, useMemo, useCallback, memo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp, Search, Download, Calendar, GripVertical, X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, formatBusinessNumber, formatDateText } from '@/lib/format'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import { mergeRowsPreservingIdentity } from '@/lib/mergeRows'
import { deleteFranchiseRows } from './actions'
import type { ApplicantType, EquipmentItem, FranchiseApplication, FranchiseApplicationLog, FranchiseStatus, Profile } from '@/types'
import { APPLICANT_TYPE_LABEL, FRANCHISE_STATUS_LABEL, FRANCHISE_STATUS_COLOR } from '@/types'
import type { DocCase } from '@/lib/solapi'
import { useToast } from '@/components/ui/Toast'
import BulkConfirmDialog from '@/components/ui/BulkConfirmDialog'
import FormModal from '@/components/ui/FormModal'
import HistoryButton from '@/components/ui/HistoryButton'
import HistoryIcon from '@/components/ui/HistoryIcon'
import {
  docCaseOf,
  createLinkedInstallTicket as createLinkedInstallTicketShared,
  applyFranchiseStatusSideEffects,
  notifyAndLogFranchiseStatus,
} from '@/lib/franchiseStatusEffects'

const DOC_CASE_LABEL: Record<DocCase, string> = {
  both: '대표자명+상호명',
  business_only: '상호명만',
  owner_only: '대표자명만',
  phone_only: '번호만',
}

const RECEPTION_CHANNELS = ['토스 홈페이지', '직접 영업', '전환', '토스리드건', '토스프리미엄', '승계', '명변', '랜탈', '할부']
const EQUIPMENT_CATALOG = ['토스프론트', '포스기', '인터넷', '키오스크', '영수증프린터', '주방프린터기', '키오스크리더기', '무선단말기', '금전함', '태블릿', '테이블오더', '보조배터리']
const VAN_COMPANIES = ['코세스2', '코세스1', '코벤', '기가맹']
const INTERNET_PROVIDERS = ['3S', '백메가']

function parseVanList(value: string) {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
}

const AUTO_FORMAT: Partial<Record<keyof FranchiseApplication, (raw: string) => string>> = {
  phone: formatPhone,
  business_number: formatBusinessNumber,
}

interface Props {
  rows: FranchiseApplication[]
  salesProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  csProfiles: Pick<Profile, 'id' | 'name' | 'role'>[]
  currentUserId: string
  currentUserName: string
  currentUserRole: string
  initialStatusFilter?: string
  initialHighlightId?: string
  linkedInstalls?: Record<string, { id: string; status: string }>
  linkedInternets?: Record<string, { id: string; status: string | null; category: string | null }>
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
  reception_date: '',
  open_date: '',
  install_date: '',
  van_company: '',
  internet: '',
  memo: '',
  sendDocNotify: false,
}

function defaultCreateForm() {
  return { ...EMPTY_FORM, reception_date: new Date().toISOString().slice(0, 10) }
}


const STATUS_DROPDOWN_HIDDEN: FranchiseStatus[] = ['internet_apply_done', 'internet_done', 'card_internet_apply_done']
const SELECTABLE_FRANCHISE_STATUSES = (Object.keys(FRANCHISE_STATUS_LABEL) as FranchiseStatus[])
  .filter(s => !STATUS_DROPDOWN_HIDDEN.includes(s))

const ALIMTALK_LOG_LABEL: Record<string, string> = {
  doc_request: '서류 안내',
  doc_incomplete: '서류미비',
  card_apply_done: '카드접수완료',
  card_done: '카드가맹완료',
  internet_apply_done: '인터넷접수완료',
  internet_done: '인터넷개통완료',
  toss_review_apply_done: '토스심사접수완료',
  toss_review_done: '토스심사완료',
}

const INSTALL_LOG_LABEL: Record<string, string> = {
  install_transfer: '기술지원 이관',
  install_retransfer: '기술지원 재이관',
  install_rejected: '기술지원 반려',
  card_done: '설치완료 (가맹접수 자동갱신)',
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

function VanMultiSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = parseVanList(value)
  function toggle(name: string) {
    const next = selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]
    onChange(next.join(','))
  }
  return (
    <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
      {VAN_COMPANIES.map(v => (
        <label key={v} className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="accent-blue-600" />
          {v}
        </label>
      ))}
    </div>
  )
}


interface EditableTextProps {
  row: FranchiseApplication
  field: keyof FranchiseApplication
  placeholder: string
  type?: string
  onSave: (row: FranchiseApplication, field: keyof FranchiseApplication, value: string) => void
}
const EditableText = memo(function EditableText({ row, field, placeholder, type = 'text', onSave }: EditableTextProps) {
  const [value, setValue] = useState((row[field] as string) ?? '')
  const autoFormat = AUTO_FORMAT[field]
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => setValue(autoFormat ? autoFormat(e.target.value) : e.target.value)}
      onBlur={() => {
        if (value !== ((row[field] as string) ?? '')) onSave(row, field, value)
      }}
      onClick={e => e.stopPropagation()}
      className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
    />
  )
})


interface EditableMemoProps {
  row: FranchiseApplication
  onSave: (row: FranchiseApplication, field: keyof FranchiseApplication, value: string) => void
}
const EditableMemo = memo(function EditableMemo({ row, onSave }: EditableMemoProps) {
  const [value, setValue] = useState('')
  return (
    <textarea
      value={value}
      placeholder="새 히스토리 입력..."
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value.trim()) { onSave(row, 'memo', value); setValue('') } }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          if (value.trim()) { onSave(row, 'memo', value); setValue('') }
        }
      }}
      onClick={e => e.stopPropagation()}
      rows={2}
      className="w-full bg-transparent border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-2 py-1 text-sm resize-y"
    />
  )
})


// 스탬프(`[이름 MM. DD. HH:mm]`)가 붙은 항목뿐 아니라, 스탬프 도입 전에 저장된 맨 텍스트도 하나의 항목으로 살려서 반환한다
function parseMemoEntries(memo: string | undefined, fallbackAt: string): { at: string; user: string; text: string }[] {
  if (!memo?.trim()) return []
  const re = /\[(.+?) (\d{2})\. (\d{2})\. (\d{2}):(\d{2})\]/g
  const matches = [...memo.matchAll(re)]
  if (matches.length === 0) {
    return [{ at: fallbackAt, user: '-', text: memo.trim() }]
  }
  const entries: { at: string; user: string; text: string }[] = []
  const leading = memo.slice(0, matches[0].index).trim()
  if (leading) entries.push({ at: fallbackAt, user: '-', text: leading })
  matches.forEach((m, i) => {
    const [, user, month, day, hour, minute] = m
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : memo.length
    const text = memo.slice(start, end).trim()
    if (!text) return
    const now = new Date()
    const at = new Date(now.getFullYear(), Number(month) - 1, Number(day), Number(hour), Number(minute)).toISOString()
    entries.push({ at, user, text })
  })
  return entries
}
// 비고 + 상태 변경 이력을 한 화면(플로팅 창)에서 시간순으로 합쳐 보여준다
interface HistoryPanelProps {
  row: FranchiseApplication
  logs: FranchiseApplicationLog[] | undefined
  onSave: (row: FranchiseApplication, field: keyof FranchiseApplication, value: string) => void
  onClose: () => void
}
const HistoryPanel = memo(function HistoryPanel({ row, logs, onSave, onClose }: HistoryPanelProps) {
  const timeline = [
    ...parseMemoEntries(row.memo, row.created_at).map(entry => ({ at: entry.at, node: (
      <li key={`memo-${entry.at}-${entry.text}`} className="text-[21pt] text-slate-200">
        <div className="text-slate-400">{new Date(entry.at).toLocaleString('ko-KR')} · {entry.user}</div>
        <div>{entry.text}</div>
      </li>
    ) })),
    ...(logs ?? []).map(log => {
      const isAlimtalk = log.to_status?.startsWith('alimtalk:')
      const isInstallEvent = log.to_status && INSTALL_LOG_LABEL[log.to_status]
      if (isAlimtalk) {
        const key = log.to_status!.replace('alimtalk:', '')
        return { at: log.created_at, node: (
          <li key={log.id} className="text-[21pt] text-blue-400">
            <div className="text-slate-400">{new Date(log.created_at).toLocaleString('ko-KR')} · {log.user?.name ?? '알수없음'}</div>
            <div>알림톡 발송 ({ALIMTALK_LOG_LABEL[key] ?? key})</div>
          </li>
        ) }
      }
      if (isInstallEvent) {
        return { at: log.created_at, node: (
          <li key={log.id} className="text-[21pt] text-purple-400 font-medium">
            <div className="text-slate-400 font-normal">{new Date(log.created_at).toLocaleString('ko-KR')} · {log.user?.name ?? '알수없음'}</div>
            <div>{INSTALL_LOG_LABEL[log.to_status!]}</div>
          </li>
        ) }
      }
      return { at: log.created_at, node: (
        <li key={log.id} className="text-[21pt] text-slate-300">
          <div className="text-slate-400">{new Date(log.created_at).toLocaleString('ko-KR')} · {log.user?.name ?? '알수없음'}</div>
          <div>
            {log.from_status ? FRANCHISE_STATUS_LABEL[log.from_status as FranchiseStatus] ?? log.from_status : '-'} →{' '}
            {log.to_status ? FRANCHISE_STATUS_LABEL[log.to_status as FranchiseStatus] ?? log.to_status : '-'}
          </div>
        </li>
      ) }
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[36rem] max-w-[calc(100vw-3rem)] h-[95vh] max-h-[95vh] flex flex-col bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <p className="flex items-center gap-2 text-base font-semibold">
          <HistoryIcon size={32} />
          히스토리 · {row.business_name || row.owner_name || '-'}
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors" aria-label="닫기">
          <X size={20} />
        </button>
      </div>
      <div className="px-5 py-4 border-b border-slate-700">
        <label className="text-xs font-semibold text-slate-400">히스토리 추가</label>
        <EditableMemo row={row} onSave={onSave} />
      </div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        {!logs ? (
          <p className="text-[21pt] text-slate-400">불러오는 중...</p>
        ) : timeline.length === 0 ? (
          <p className="text-[21pt] text-slate-400">이력이 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">{timeline.map(entry => entry.node)}</ul>
        )}
      </div>
    </div>
  )
})

interface DateFieldProps {
  row: FranchiseApplication
  field: keyof FranchiseApplication
  onSave: (row: FranchiseApplication, field: keyof FranchiseApplication, value: string) => void
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
    <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
      <input
        value={value}
        onChange={e => setValue(formatDateText(e.target.value))}
        onBlur={() => {
          if (value !== ((row[field] as string) ?? '')) onSave(row, field, value)
        }}
        placeholder="-"
        className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
      />
      <button type="button" onClick={openPicker} tabIndex={-1} aria-label="날짜 선택" className="shrink-0 text-slate-400 hover:text-blue-500">
        <Calendar size={14} />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={isoValue}
        onChange={handlePick}
        tabIndex={-1}
        className="w-0 h-0 opacity-0 absolute pointer-events-none"
      />
    </div>
  )
})


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
      <input value={value} onChange={e => onChange(formatDateText(e.target.value))}
        className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" onClick={openPicker} aria-label="날짜 선택" className="shrink-0 text-slate-400 hover:text-blue-500">
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


const NEXT_STATUS: Partial<Record<FranchiseStatus, FranchiseStatus>> = {
  doc_waiting: 'card_apply_done',
  doc_incomplete: 'card_apply_done',
  card_apply_done: 'toss_review_apply_done',
  toss_review_apply_done: 'toss_review_done',
  toss_review_done: 'card_done',
  card_done: 'completed',
}

const MAIN_COLUMNS = [
  { key: 'reception_date', label: '접수날짜' },
  { key: 'reception_channel', label: '접수채널' },
  { key: 'applicant_type', label: '사업자유형' },
  { key: 'business_name', label: '상호명' },
  { key: 'owner_name', label: '대표자' },
  { key: 'phone', label: '연락처' },
  { key: 'creator', label: '등록자' },
  { key: 'cs_id', label: '담당자' },
  { key: 'internet_status', label: '인터넷' },
  { key: 'status', label: '상태' },
  { key: 'memo', label: '메모' },
] as const
const DEFAULT_WIDTHS: Record<string, number> = {
  reception_date: 100,
  reception_channel: 90,
  applicant_type: 110,
  business_name: 160,
  owner_name: 90,
  phone: 130,
  creator: 80,
  cs_id: 90,
  internet_status: 110,
  status: 140,
  memo: 160,
}
const COL_WIDTHS_STORAGE_KEY = 'franchise_col_widths'
const PAGE_SIZE = 50


interface CreateFormProps {
  onSubmit: (form: typeof EMPTY_FORM) => Promise<boolean>
  submitting: boolean
  onClose: () => void
}
const CreateForm = memo(function CreateForm({ onSubmit, submitting, onClose }: CreateFormProps) {
  const [form, setForm] = useState(defaultCreateForm)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const success = await onSubmit(form)
    if (success) setForm(defaultCreateForm())
  }

  return (
    <FormModal title="프랜차이즈 정보 입력" onClose={onClose} maxWidthClassName="max-w-3xl">
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">접수날짜</label>
        <DateFormField value={form.reception_date} onChange={v => setForm({ ...form, reception_date: v })} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">접수채널</label>
        <select value={form.reception_channel} onChange={e => setForm({ ...form, reception_channel: e.target.value })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">선택 안함</option>
          {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
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
        <label className="text-xs font-medium text-slate-500">사업자번호</label>
        <input value={form.business_number} onChange={e => setForm({ ...form, business_number: formatBusinessNumber(e.target.value) })} placeholder="000-00-00000"
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">연락처</label>
        <input value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="010-0000-0000"
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">인터넷</label>
        <select value={form.internet} onChange={e => setForm({ ...form, internet: e.target.value })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">선택 안함</option>
          {INTERNET_PROVIDERS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">VAN사 (중복선택 가능)</label>
        <VanMultiSelect value={form.van_company} onChange={v => setForm({ ...form, van_company: v })} />
      </div>
      {form.applicant_type !== 'giga_individual' && form.applicant_type !== 'giga_corporate' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">오픈예정일</label>
          <DateFormField value={form.open_date} onChange={v => setForm({ ...form, open_date: v })} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">설치 및 발송일</label>
        <DateFormField value={form.install_date} onChange={v => setForm({ ...form, install_date: v })} />
      </div>
      <div className="flex flex-col gap-1 w-full">
        <label className="text-xs font-medium text-slate-500">상품</label>
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
      <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
        <label className="text-xs font-medium text-slate-500">비고</label>
        <input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.sendDocNotify} onChange={e => setForm({ ...form, sendDocNotify: e.target.checked })}
            className="w-4 h-4 accent-blue-600" />
          등록 즉시 서류안내 알림톡 발송
        </label>
        <button type="submit" disabled={submitting}
          className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
    </FormModal>
  )
})

export default function FranchiseClient({ rows, salesProfiles, csProfiles, currentUserId, currentUserName, currentUserRole, initialStatusFilter = '', initialHighlightId, linkedInstalls = {}, linkedInternets = {} }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [localRows, setLocalRows] = useState(rows)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [localLinkedInstalls, setLocalLinkedInstalls] = useState<Record<string, { id: string; status: string }>>(linkedInstalls)
  
  
  const localLinkedInstallsRef = useRef(localLinkedInstalls)
  useEffect(() => { localLinkedInstallsRef.current = localLinkedInstalls }, [localLinkedInstalls])
  const [localLinkedInternets, setLocalLinkedInternets] = useState<Record<string, { id: string; status: string | null; category: string | null }>>(linkedInternets)
  const [linkingInternetId, setLinkingInternetId] = useState<string | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{ row: FranchiseApplication; newStatus: FranchiseStatus; msg: string; docCase?: DocCase } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logsByRow, setLogsByRow] = useState<Record<string, FranchiseApplicationLog[]>>({})
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [applicantTypeFilter, setApplicantTypeFilter] = useState('')
  const [salesFilter, setSalesFilter] = useState('')
  const [csFilter, setCsFilter] = useState('')
  
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'open_date' | 'install_date' | 'status' | 'manual'>('created_at')
  const [rowDragId, setRowDragId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { colWidths, startResize } = useColumnWidths(COL_WIDTHS_STORAGE_KEY, DEFAULT_WIDTHS)
  const [vanFilter, setVanFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [bulkStatusModal, setBulkStatusModal] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<FranchiseStatus | ''>('')
  const [bulkChanging, setBulkChanging] = useState(false)
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [transferTab, setTransferTab] = useState<'all' | 'transferred' | 'rejected' | 'completed'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [bulkAssignModal, setBulkAssignModal] = useState(false)
  const [bulkAssignCs, setBulkAssignCs] = useState('')
  const [bulkAssignSales, setBulkAssignSales] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [savedFilters, setSavedFilters] = useState<{ name: string; filters: Record<string, string> }[]>(() => {
    try { return JSON.parse(localStorage.getItem('franchise_saved_filters') ?? '[]') } catch { return [] }
  })
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    setLocalRows(prev => mergeRowsPreservingIdentity(prev, rows))
    setSelected(new Set())
  }, [rows])

  
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'n' || e.key === 'N') setShowForm(v => !v)
      if (e.key === '?') setShowShortcuts(v => !v)
      if (e.key === 'Escape') { setShowShortcuts(false); setShowForm(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  
  
  
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const supabase = createClient()
    for (const days of [7, 3, 1]) {
      const templateKey = `franchise_dday_${days}_${today}`
      ;(async () => {
        try {
          const { data: already } = await supabase
            .from('notification_logs')
            .select('id')
            .eq('entity_type', 'franchise_dday_notify')
            .eq('entity_id', currentUserId)
            .eq('template_key', templateKey)
            .limit(1)
            .maybeSingle()
          if (already) return
          const target = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
          const matched = rows.filter(r =>
            r.open_date === target &&
            (currentUserRole === 'admin' || r.cs_id === currentUserId || r.sales_id === currentUserId)
          )
          if (matched.length === 0) return
          const names = matched.map(r => r.business_name || r.owner_name || '미입력').join(', ')
          const { error } = await supabase.from('notifications').insert({
            user_id: currentUserId,
            type: 'open_date_soon',
            title: `오픈 D-${days} 알림 ${matched.length}건`,
            body: `${names} — ${days}일 후 오픈 예정입니다. 준비 상태를 확인해주세요.`,
          })
          if (error) { toast.error('D-day 알림 생성 실패: ' + error.message); return }
          await supabase.from('notification_logs').insert({
            entity_type: 'franchise_dday_notify',
            entity_id: currentUserId,
            template_key: templateKey,
            user_id: currentUserId,
          })
        } catch (err) {
          console.error('D-day 알림 처리 실패:', err)
        }
      })()
    }
  }, [])

  
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const key = `reject_renotify_${currentUserId}_${today}`
    if (localStorage.getItem(key)) return
    
    
    localStorage.setItem(key, '1')
  }, [])

  
  
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const templateKey = `franchise_stale_${today}`
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: already } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('entity_type', 'franchise_stale_notify')
          .eq('entity_id', currentUserId)
          .eq('template_key', templateKey)
          .limit(1)
          .maybeSingle()
        if (already) return
        const terminal: FranchiseStatus[] = ['card_done', 'internet_done']
        const stale = rows.filter(r =>
          !terminal.includes(r.status) &&
          Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000) >= 7 &&
          (currentUserRole === 'admin' || r.cs_id === currentUserId || r.sales_id === currentUserId)
        )
        if (stale.length === 0) return
        const names = stale.slice(0, 3).map(r => r.business_name || r.owner_name || '미입력').join(', ')
        const { error } = await supabase.from('notifications').insert({
          user_id: currentUserId,
          type: 'stale_franchise',
          title: `장기 미처리 건 ${stale.length}개`,
          body: names + (stale.length > 3 ? ` 외 ${stale.length - 3}건` : '') + ' — 7일 이상 상태 변화가 없습니다.',
        })
        if (error) { toast.error('장기 미처리 알림 생성 실패: ' + error.message); return }
        await supabase.from('notification_logs').insert({
          entity_type: 'franchise_stale_notify',
          entity_id: currentUserId,
          template_key: templateKey,
          user_id: currentUserId,
        })
      } catch (err) {
        console.error('장기 미처리 알림 처리 실패:', err)
      }
    })()
  }, [])

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

  const transferredIds = useMemo(() => new Set(Object.keys(localLinkedInstalls)), [localLinkedInstalls])
  const rejectedIds = useMemo(() => new Set(Object.entries(localLinkedInstalls).filter(([, v]) => v.status === 'rejected').map(([k]) => k)), [localLinkedInstalls])
  const completedIds = useMemo(() => new Set(localRows.filter(r => r.status === 'completed').map(r => r.id)), [localRows])

  
  
  
  
  
  const isHiddenInAllTab = useCallback((row: FranchiseApplication, statusForRule: FranchiseStatus | '') => {
    if (statusForRule !== 'completed' && completedIds.has(row.id)) return true
    return false
  }, [completedIds])

  
  
  
  
  
  type FilterSkip = { skipTab?: boolean; skipStatus?: boolean; skipChannel?: boolean; statusForTabRule?: FranchiseStatus }
  const matchesFilters = useCallback((row: FranchiseApplication, skip: FilterSkip = {}) => {
    if (!skip.skipTab) {
      if (transferTab === 'transferred' && !transferredIds.has(row.id)) return false
      if (transferTab === 'rejected' && !rejectedIds.has(row.id)) return false
      if (transferTab === 'completed' && !completedIds.has(row.id)) return false
      if (transferTab === 'all' && isHiddenInAllTab(row, skip.statusForTabRule ?? (statusFilter as FranchiseStatus | ''))) return false
    }
    if (!skip.skipStatus && statusFilter && row.status !== statusFilter) return false
    if (applicantTypeFilter && row.applicant_type !== applicantTypeFilter) return false
    if (!skip.skipChannel && channelFilter && (row.reception_channel || '미지정') !== channelFilter) return false
    if (vanFilter && !row.van_company?.split(',').map(s => s.trim()).includes(vanFilter)) return false
    if (dateFrom || dateTo) {
      const createdLocalDate = format(new Date(row.created_at), 'yyyy-MM-dd')
      if (dateFrom && createdLocalDate < dateFrom) return false
      if (dateTo && createdLocalDate > dateTo) return false
    }
    return true
  }, [transferTab, transferredIds, rejectedIds, completedIds, isHiddenInAllTab, statusFilter, applicantTypeFilter, channelFilter, vanFilter, dateFrom, dateTo])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = localRows.filter(row => {
      if (!matchesFilters(row)) return false
      if (term) {
        const haystack = `${row.business_name ?? ''} ${row.owner_name ?? ''} ${row.phone ?? ''} ${row.business_number ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'status') return a.status.localeCompare(b.status)
      if (sortBy === 'open_date') return (a.open_date ?? '').localeCompare(b.open_date ?? '')
      if (sortBy === 'install_date') return (a.install_date ?? '').localeCompare(b.install_date ?? '')
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'manual') return (b.sort_order ?? new Date(b.created_at).getTime()) - (a.sort_order ?? new Date(a.created_at).getTime())
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [localRows, search, sortBy, matchesFilters])

  useEffect(() => { setPage(1) }, [search, statusFilter, applicantTypeFilter, channelFilter, vanFilter, sortBy, transferTab, dateFrom, dateTo])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const highlightAppliedRef = useRef(false)
  useEffect(() => {
    if (!initialHighlightId || highlightAppliedRef.current) return
    const target = localRows.find(r => r.id === initialHighlightId)
    if (!target) return
    highlightAppliedRef.current = true
    setSearch('')
    setStatusFilter('')
    setApplicantTypeFilter('')
    setChannelFilter('')
    setVanFilter('')
    setDateFrom('')
    setDateTo('')
    setTransferTab('all')
    toggleExpand(target)
  }, [initialHighlightId, localRows])

  useEffect(() => {
    if (!initialHighlightId) return
    const idx = filteredRows.findIndex(r => r.id === initialHighlightId)
    if (idx === -1) return
    setPage(Math.floor(idx / PAGE_SIZE) + 1)
    setTimeout(() => {
      document.getElementById(`franchise-row-${initialHighlightId}`)?.scrollIntoView({ block: 'center' })
    }, 50)
  }, [initialHighlightId, filteredRows])

  const canReorder = sortBy === 'manual' && !search.trim() && !statusFilter && !applicantTypeFilter
    && !channelFilter && !vanFilter && !dateFrom && !dateTo && transferTab === 'all'

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
      supabase.from('franchise_applications').update({ sort_order: (n - i) * 1000 }).eq('id', r.id)
    )).catch(() => toast.error('순서 저장에 실패했습니다.'))
  }, [localRows, toast])

  function shareLink(id: string) {
    const url = `${window.location.origin}/franchise?id=${id}`
    navigator.clipboard.writeText(url)
    toast.success('건별 링크가 복사됐습니다.')
  }

  function completeness(row: FranchiseApplication): number {
    const fields = [row.business_name, row.owner_name, row.phone, row.business_number, row.address, row.open_date, row.cs_id, row.sales_id]
    return Math.round(fields.filter(Boolean).length / fields.length * 100)
  }

  function saveFilterPreset() {
    const name = prompt('필터 프리셋 이름을 입력하세요:')
    if (!name) return
    const preset = { name, filters: { statusFilter, applicantTypeFilter, salesFilter, csFilter, sortBy } }
    const next = [...savedFilters, preset]
    setSavedFilters(next)
    localStorage.setItem('franchise_saved_filters', JSON.stringify(next))
  }

  function loadFilterPreset(preset: { name: string; filters: Record<string, string> }) {
    setStatusFilter(preset.filters.statusFilter ?? '')
    setApplicantTypeFilter(preset.filters.applicantTypeFilter ?? '')
    setSalesFilter(preset.filters.salesFilter ?? '')
    setCsFilter(preset.filters.csFilter ?? '')
    setSortBy((preset.filters.sortBy as typeof sortBy) ?? 'updated_at')
  }

  function removeFilterPreset(name: string) {
    if (!confirm(`'${name}' 프리셋을 삭제하시겠습니까?`)) return
    const next = savedFilters.filter(f => f.name !== name)
    setSavedFilters(next)
    localStorage.setItem('franchise_saved_filters', JSON.stringify(next))
  }

  async function handleBulkAssign() {
    if (!bulkAssignCs && !bulkAssignSales) return
    setBulkAssigning(true)
    const supabase = createClient()
    const ids = [...selected]
    const patch: Record<string, string | null> = {}
    if (bulkAssignCs) patch.cs_id = bulkAssignCs
    if (bulkAssignSales) patch.sales_id = bulkAssignSales
    const { error } = await supabase.from('franchise_applications').update(patch).in('id', ids)
    setBulkAssigning(false)
    if (error) { toast.error('일괄 배정 실패: ' + error.message); return }
    const cs = bulkAssignCs ? csProfiles.find(p => p.id === bulkAssignCs) ?? null : undefined
    const sales = bulkAssignSales ? salesProfiles.find(p => p.id === bulkAssignSales) ?? null : undefined
    const idSet = new Set(ids)
    setLocalRows(prev => prev.map(r => idSet.has(r.id) ? {
      ...r,
      ...(bulkAssignCs ? { cs_id: bulkAssignCs, cs: cs as FranchiseApplication['cs'] } : {}),
      ...(bulkAssignSales ? { sales_id: bulkAssignSales, sales: sales as FranchiseApplication['sales'] } : {}),
    } : r))
    setBulkAssignModal(false)
    setBulkAssignCs('')
    setBulkAssignSales('')
    setSelected(new Set())
  }

  function statusAgeDays(row: FranchiseApplication) {
    const ms = Date.now() - new Date(row.updated_at).getTime()
    return Math.floor(ms / 86400000)
  }

  
  
  
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<FranchiseStatus, number>> = {}
    for (const row of localRows) {
      
      
      if (!matchesFilters(row, { skipStatus: true, statusForTabRule: row.status })) continue
      counts[row.status] = (counts[row.status] ?? 0) + 1
    }
    return counts
  }, [localRows, matchesFilters])

  
  const tabCounts = useMemo(() => {
    const base = localRows.filter(row => matchesFilters(row, { skipTab: true }))
    return {
      all: base.filter(r => !isHiddenInAllTab(r, statusFilter as FranchiseStatus | '')).length,
      transferred: base.filter(r => transferredIds.has(r.id)).length,
      rejected: base.filter(r => rejectedIds.has(r.id)).length,
      completed: base.filter(r => completedIds.has(r.id)).length,
    }
  }, [localRows, matchesFilters, isHiddenInAllTab, statusFilter, transferredIds, completedIds, rejectedIds])

  
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of localRows) {
      if (!matchesFilters(row, { skipChannel: true })) continue
      const ch = row.reception_channel || '미지정'
      counts[ch] = (counts[ch] ?? 0) + 1
    }
    return counts
  }, [localRows, matchesFilters])

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

  
  
  const selectAllFiltered = useCallback(() => {
    setSelected(new Set(filteredRows.map(r => r.id)))
  }, [filteredRows])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(() => {
    if (selected.size === 0) return
    setDeleteConfirmOpen(true)
  }, [selected])

  const confirmDelete = useCallback(async () => {
    setDeleting(true)
    const { error } = await deleteFranchiseRows([...selected])
    setDeleting(false)
    setDeleteConfirmOpen(false)
    if (error) { toast.error('삭제 실패: ' + error); return }
    setLocalRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
  }, [selected, toast])

  async function handleCreate(form: typeof EMPTY_FORM): Promise<boolean> {
    
    if (form.phone || form.business_name || form.business_number) {
      const dupe = localRows.find(r =>
        (form.phone && r.phone === form.phone) ||
        (form.business_name && r.business_name === form.business_name) ||
        (form.business_number && r.business_number === form.business_number)
      )
      if (dupe) {
        const label = dupe.business_name || dupe.owner_name || dupe.phone || ''
        if (!confirm(`"${label}" 건이 이미 접수되어 있습니다 (상태: ${FRANCHISE_STATUS_LABEL[dupe.status]}). 그래도 등록하시겠습니까?`)) return false
      }
    }
    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('franchise_applications').insert({
      business_name: form.business_name || null,
      owner_name: form.owner_name || null,
      phone: form.phone ? formatPhone(form.phone) : null,
      business_number: form.business_number ? formatBusinessNumber(form.business_number) : null,
      equipment_items: form.equipmentItems,
      address: form.address || null,
      address_detail: form.address_detail || null,
      title: form.title || null,
      sales_id: form.sales_id || null,
      cs_id: form.cs_id || null,
      applicant_type: form.applicant_type,
      status: 'doc_waiting',
      reception_channel: form.reception_channel || null,
      reception_date: form.reception_date ? formatDateText(form.reception_date) : null,
      open_date: form.open_date ? formatDateText(form.open_date) : null,
      install_date: form.install_date ? formatDateText(form.install_date) : null,
      van_company: form.van_company || null,
      internet: form.internet || null,
      memo: form.memo || null,
      created_by: currentUserId,
    }).select().single()
    setSubmitting(false)
    if (error) { toast.error('등록 실패: ' + error.message); return false }
    
    if (form.sendDocNotify && form.phone) {
      const docCase = docCaseOf(form.owner_name, form.business_name)
      try {
        await fetch('/api/franchise/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'doc_request', phone: form.phone, ownerName: form.owner_name, businessName: form.business_name, applicantType: form.applicant_type, docCase }),
        })
      } catch {  }
    }
    setShowForm(false)
    const sales = form.sales_id ? salesProfiles.find(p => p.id === form.sales_id) ?? null : null
    const cs = form.cs_id ? csProfiles.find(p => p.id === form.cs_id) ?? null : null
    setLocalRows(prev => [{ ...data, sales: sales as FranchiseApplication['sales'], cs: cs as FranchiseApplication['cs'], creator: { name: currentUserName } as FranchiseApplication['creator'] }, ...prev])
    return true
  }

  async function createLinkedInstallTicket(row: FranchiseApplication) {
    await createLinkedInstallTicketShared(row, toast)
  }

  async function updateStatus(row: FranchiseApplication, status: FranchiseStatus, sendNotify: boolean, docCase?: DocCase) {
    setBusyId(row.id)
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'doc_waiting') patch.doc_template = APPLICANT_TYPE_LABEL[row.applicant_type]
    const { error } = await supabase.from('franchise_applications').update(patch).eq('id', row.id)
    if (error) { setBusyId(null); toast.error('상태 변경 실패: ' + error.message); return }

    await supabase.from('franchise_application_logs').insert({
      franchise_application_id: row.id,
      user_id: currentUserId,
      from_status: row.status,
      to_status: status,
    })

    const { linkedInstall } = await applyFranchiseStatusSideEffects({
      row, status, sendNotify, docCase, currentUserId, toast,
      existingLinkedInstall: localLinkedInstalls[row.id],
    })
    if (linkedInstall) setLocalLinkedInstalls(prev => ({ ...prev, [row.id]: linkedInstall }))
    setBusyId(null)
    setLocalRows(prev => prev.map(r => r.id === row.id
      ? { ...r, status, doc_template: status === 'doc_waiting' ? APPLICANT_TYPE_LABEL[row.applicant_type] : r.doc_template, updated_at: new Date().toISOString() }
      : r))
  }

  async function updateApplicantType(row: FranchiseApplication, applicantType: ApplicantType) {
    if (applicantType === row.applicant_type) return
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ applicant_type: applicantType }).eq('id', row.id)
    if (error) { toast.error('사업자 유형 변경 실패: ' + error.message); return }
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, applicant_type: applicantType, updated_at: new Date().toISOString() } : r))
  }

  async function updateCs(row: FranchiseApplication, csId: string) {
    if (csId === (row.cs_id ?? '')) return
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ cs_id: csId || null }).eq('id', row.id)
    if (error) { toast.error('담당 CS 변경 실패: ' + error.message); return }
    const cs = csId ? csProfiles.find(p => p.id === csId) ?? null : null
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, cs_id: csId || undefined, cs: cs as FranchiseApplication['cs'], updated_at: new Date().toISOString() } : r))
  }

  async function updateSales(row: FranchiseApplication, salesId: string) {
    if (salesId === (row.sales_id ?? '')) return
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ sales_id: salesId || null }).eq('id', row.id)
    if (error) { toast.error('담당 영업 변경 실패: ' + error.message); return }
    const sales = salesId ? salesProfiles.find(p => p.id === salesId) ?? null : null
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, sales_id: salesId || undefined, sales: sales as FranchiseApplication['sales'], updated_at: new Date().toISOString() } : r))
  }

  const saveField = useCallback(async (row: FranchiseApplication, field: keyof FranchiseApplication, value: string) => {
    const supabase = createClient()
    let saveValue: string | null = value || null
    if (field === 'memo' && value) {
      const stamp = `[${currentUserName} ${new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}]`
      const prev = (row.memo ?? '').trim()
      saveValue = prev ? `${prev}\n${stamp} ${value}` : `${stamp} ${value}`
    }
    const { error } = await supabase.from('franchise_applications').update({ [field]: saveValue }).eq('id', row.id)
    if (error) { toast.error('수정 실패: ' + error.message); return }
    
    const linked = localLinkedInstallsRef.current[row.id]
    if (linked && (field === 'business_name' || field === 'owner_name' || field === 'phone' || field === 'address')) {
      const patch: Record<string, string | null> = {}
      if (field === 'business_name' || field === 'owner_name') {
        const businessName = field === 'business_name' ? saveValue : row.business_name
        const ownerName = field === 'owner_name' ? saveValue : row.owner_name
        patch.customer_name = businessName || ownerName || '미입력'
      } else if (field === 'phone') {
        patch.customer_phone = saveValue
      } else if (field === 'address') {
        patch.address = saveValue
      }
      const { error: syncError } = await supabase.from('installations').update(patch).eq('id', linked.id)
      if (syncError) toast.error('설치관리 동기화 실패: ' + syncError.message)
    }
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: saveValue ?? undefined, updated_at: new Date().toISOString() } : r))
  }, [currentUserName])

  async function saveEquipmentItems(row: FranchiseApplication, items: EquipmentItem[]) {
    const supabase = createClient()
    const { error } = await supabase.from('franchise_applications').update({ equipment_items: items }).eq('id', row.id)
    if (error) { toast.error('수정 실패: ' + error.message); return }
    
    const linked = localLinkedInstalls[row.id]
    if (linked) {
      const { error: syncError } = await supabase.from('installations').update({ items }).eq('id', linked.id)
      if (syncError) toast.error('설치관리 동기화 실패: ' + syncError.message)
    }
    setLocalRows(prev => prev.map(r => r.id === row.id ? { ...r, equipment_items: items, updated_at: new Date().toISOString() } : r))
  }

  async function notifyAndLog(franchiseId: string, logKey: string, payload: Record<string, unknown>) {
    await notifyAndLogFranchiseStatus(franchiseId, logKey, payload, currentUserId, toast)
    setLogsByRow(prev => prev[franchiseId] ? { ...prev, [franchiseId]: undefined as any } : prev)
  }

  function handleExcel() {
    import('xlsx').then(XLSX => {
      const data = filteredRows.map(r => ({
        상호명: r.business_name ?? '',
        대표자: r.owner_name ?? '',
        연락처: r.phone ?? '',
        사업자번호: r.business_number ?? '',
        사업자유형: APPLICANT_TYPE_LABEL[r.applicant_type],
        접수채널: r.reception_channel ?? '',
        상태: FRANCHISE_STATUS_LABEL[r.status],
        VAN사: r.van_company ?? '',
        인터넷: r.internet ?? '',
        주소: r.address ?? '',
        오픈예정일: r.open_date ?? '',
        설치발송일: r.install_date ?? '',
        담당영업: (r as any).sales?.name ?? '',
        담당CS: (r as any).cs?.name ?? '',
        비고: r.memo ?? '',
        등록일: format(new Date(r.created_at), 'yyyy-MM-dd', { locale: ko }),
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '가맹접수')
      XLSX.writeFile(wb, `가맹접수_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    })
  }

  async function handleBulkStatusChange() {
    if (!bulkStatus) return
    setBulkChanging(true)
    const supabase = createClient()
    const ids = [...selected]
    const rowsBefore = localRows.filter(r => ids.includes(r.id))
    const { error } = await supabase.from('franchise_applications').update({ status: bulkStatus }).in('id', ids)
    if (error) { setBulkChanging(false); toast.error('일괄 변경 실패: ' + error.message); return }
    await supabase.from('franchise_application_logs').insert(
      rowsBefore.map(r => ({
        franchise_application_id: r.id,
        user_id: currentUserId,
        from_status: r.status,
        to_status: bulkStatus,
      }))
    )
    setBulkChanging(false)
    const idSet = new Set(ids)
    const status = bulkStatus
    setLocalRows(prev => prev.map(r => idSet.has(r.id) ? { ...r, status, updated_at: new Date().toISOString() } : r))
    setBulkStatusModal(false)
    setBulkStatus('')
    setSelected(new Set())
  }

  async function transferToTech(row: FranchiseApplication) {
    const existing = localLinkedInstalls[row.id]
    const isRetransfer = existing?.status === 'rejected'
    if (existing && !isRetransfer) { toast.warning('이미 기술지원으로 이관된 접수입니다.'); return }
    const label = isRetransfer ? '재이관' : '이관'
    if (!confirm(`'${row.business_name || row.owner_name || '미입력'}' 접수를 기술지원으로 ${label}하시겠습니까?${isRetransfer ? '\n반려된 설치건이 다시 접수 상태로 변경됩니다.' : '\n설치관리 탭에 새 설치건이 생성됩니다.'}`)) return
    setTransferringId(row.id)
    const supabase = createClient()

    let installId: string
    if (isRetransfer) {
      const { error } = await supabase.from('installations').update({
        status: 'received',
        notes: row.memo || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) { toast.error('재이관 실패: ' + error.message); setTransferringId(null); return }
      installId = existing.id
    } else {
      const { data, error } = await supabase.from('installations').insert({
        customer_name: row.business_name || row.owner_name || '미입력',
        customer_phone: row.phone || null,
        items: row.equipment_items ?? [],
        status: 'received',
        notes: row.memo || null,
        franchise_application_id: row.id,
        address: row.address || null,
        scheduled_date: row.install_date || null,
        created_by: currentUserId,
      }).select('id').single()
      if (error) { toast.error('이관 실패: ' + error.message); setTransferringId(null); return }
      installId = data.id
    }

    
    const name = row.business_name || row.owner_name || '미입력'
    const { data: techProfiles } = await supabase.from('profiles').select('id').eq('role', 'tech')
    if (techProfiles?.length) {
      const { error: notifyError } = await supabase.from('notifications').insert(techProfiles.map(u => ({
        user_id: u.id,
        franchise_application_id: row.id,
        type: 'install_transfer',
        title: `[${name}] 기술지원 ${label}`,
        body: `CS팀에서 설치건을 ${label}했습니다. 설치관리를 확인해주세요.`,
      })))
      if (notifyError) console.error('기술지원 알림 발송 실패:', notifyError.message)
    }

    
    await supabase.from('franchise_application_logs').insert({
      franchise_application_id: row.id,
      user_id: currentUserId,
      from_status: row.status,
      to_status: isRetransfer ? 'install_retransfer' : 'install_transfer',
    })

    setTransferringId(null)
    setLocalLinkedInstalls(prev => ({ ...prev, [row.id]: { id: installId, status: 'received' } }))
  }

  async function linkToInternet(row: FranchiseApplication) {
    if (localLinkedInternets[row.id]) { toast.warning('이미 인터넷관리에 등록된 접수입니다.'); return }
    if (!confirm(`'${row.business_name || row.owner_name || '미입력'}' 접수를 인터넷관리 탭에 등록하시겠습니까?`)) return
    setLinkingInternetId(row.id)
    const supabase = createClient()
    const { data, error } = await supabase.from('internet_management').insert({
      business_name: row.business_name || null,
      owner_name: row.owner_name || null,
      phone: row.phone || null,
      franchise_application_id: row.id,
      sort_order: Date.now(),
    }).select('id, status, category').single()
    setLinkingInternetId(null)
    if (error) { toast.error('인터넷관리 등록 실패: ' + error.message); return }
    setLocalLinkedInternets(prev => ({ ...prev, [row.id]: { id: data.id, status: data.status, category: data.category } }))
  }

  function handleStatusChange(row: FranchiseApplication, newStatus: FranchiseStatus) {
    if (newStatus === row.status) return
    
    const canNotify = newStatus !== 'completed' && !!row.phone
    const confirmMsg = newStatus === 'completed'
      ? `'완료'로 상태만 변경됩니다. (고객 안내 메시지는 발송되지 않습니다)`
      : newStatus === 'doc_waiting'
        ? `'${APPLICANT_TYPE_LABEL[row.applicant_type]}' 서류 안내 메시지가 고객에게 발송됩니다. 아래에서 보낼 템플릿이 맞는지 확인 후 진행하세요.`
        : newStatus === 'toss_review_done'
          ? `토스심사완료로 변경하면 고객에게 메시지가 발송되고, 입력된 정보로 설치 작업이 자동 생성됩니다.`
          : `'${FRANCHISE_STATUS_LABEL[newStatus]}'(으)로 변경하면 고객에게 메시지가 발송됩니다.`
    setStatusConfirm({
      row, newStatus,
      msg: newStatus === 'completed' ? confirmMsg : canNotify ? confirmMsg : '연락처가 없어 메시지 발송 없이 상태만 변경됩니다.',
      docCase: newStatus === 'doc_waiting' ? docCaseOf(row.owner_name, row.business_name) : undefined,
    })
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

  const canNotifyConfirm = statusConfirm ? statusConfirm.newStatus !== 'completed' && !!statusConfirm.row.phone : false

  return (
    <div className="flex flex-col h-full">
      {}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-72 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-800">⌨️ 단축키 안내</p>
            {[
              ['N', '신규 접수 폼 열기/닫기'],
              ['?', '단축키 도움말'],
              ['Esc', '모달/폼 닫기'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono font-bold min-w-[32px] text-center">{key}</kbd>
                <span className="text-sm text-slate-600">{desc}</span>
              </div>
            ))}
            <button onClick={() => setShowShortcuts(false)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 text-center">닫기</button>
          </div>
        </div>
      )}

      {}
      {bulkAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-72 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">{selected.size}건 일괄 담당자 배정</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500">담당 CS</label>
              <select value={bulkAssignCs} onChange={e => setBulkAssignCs(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">변경 안함</option>
                {csProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500">담당 영업</label>
              <select value={bulkAssignSales} onChange={e => setBulkAssignSales(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">변경 안함</option>
                {salesProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleBulkAssign} disabled={(!bulkAssignCs && !bulkAssignSales) || bulkAssigning}
                className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {bulkAssigning ? '배정 중...' : '배정 확정'}
              </button>
              <button onClick={() => { setBulkAssignModal(false); setBulkAssignCs(''); setBulkAssignSales('') }}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600">취소</button>
            </div>
          </div>
        </div>
      )}

      {}
      {bulkStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-72 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">{selected.size}건 일괄 상태 변경</p>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as FranchiseStatus)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">상태 선택</option>
              {SELECTABLE_FRANCHISE_STATUSES.map(s => (
                <option key={s} value={s}>{FRANCHISE_STATUS_LABEL[s]}</option>
              ))}
            </select>
            <div className="flex flex-col gap-2">
              <button onClick={() => setBulkStatusConfirmOpen(true)} disabled={!bulkStatus || bulkChanging}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {bulkChanging ? '변경 중...' : '변경 확정'}
              </button>
              <button onClick={() => { setBulkStatusModal(false); setBulkStatus('') }}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600">취소</button>
            </div>
          </div>
        </div>
      )}

      <BulkConfirmDialog
        open={bulkStatusConfirmOpen}
        title="일괄 상태 변경"
        busy={bulkChanging}
        confirmText="변경"
        items={localRows.filter(r => selected.has(r.id)).map(r => ({
          id: r.id,
          label: r.business_name || r.owner_name || r.id,
          detail: bulkStatus ? `${FRANCHISE_STATUS_LABEL[r.status]} → ${FRANCHISE_STATUS_LABEL[bulkStatus]}` : undefined,
        }))}
        onCancel={() => setBulkStatusConfirmOpen(false)}
        onConfirm={async () => { setBulkStatusConfirmOpen(false); await handleBulkStatusChange() }}
      />

      <BulkConfirmDialog
        open={deleteConfirmOpen}
        title="선택 항목 삭제"
        busy={deleting}
        confirmText="삭제"
        confirmColor="red"
        items={localRows.filter(r => selected.has(r.id)).map(r => ({
          id: r.id,
          label: r.business_name || r.owner_name || r.id,
        }))}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <p className="text-sm text-slate-700 leading-relaxed">{statusConfirm.msg}</p>
            {statusConfirm.newStatus === 'doc_waiting' && statusConfirm.docCase && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">발송 템플릿 ({APPLICANT_TYPE_LABEL[statusConfirm.row.applicant_type]})</label>
                <select
                  value={statusConfirm.docCase}
                  onChange={e => setStatusConfirm(prev => prev ? { ...prev, docCase: e.target.value as DocCase } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {(Object.keys(DOC_CASE_LABEL) as DocCase[]).map(c => (
                    <option key={c} value={c}>{DOC_CASE_LABEL[c]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {canNotifyConfirm ? (
                <>
                  <button
                    className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    onClick={() => { const c = statusConfirm; setStatusConfirm(null); updateStatus(c.row, c.newStatus, true, c.docCase) }}
                  >카톡 발송 후 변경</button>
                  <button
                    className="w-full py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200"
                    onClick={() => { const c = statusConfirm; setStatusConfirm(null); updateStatus(c.row, c.newStatus, false, c.docCase) }}
                  >알림톡 없이 상태만 변경</button>
                </>
              ) : (
                <button
                  className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  onClick={() => { const c = statusConfirm; setStatusConfirm(null); updateStatus(c.row, c.newStatus, false, c.docCase) }}
                >상태 변경</button>
              )}
              <button
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600"
                onClick={() => setStatusConfirm(null)}
              >취소</button>
            </div>
          </div>
        </div>
      )}
      {}
      <div className="mb-2">
        <select value={transferTab} onChange={e => setTransferTab(e.target.value as typeof transferTab)}
          className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {([
            ['all', '전체', tabCounts.all],
            ['transferred', '기술지원 이관', tabCounts.transferred],
            ['rejected', '반려됨', tabCounts.rejected],
            ['completed', '완료', tabCounts.completed],
          ] as const).map(([tab, label, count]) => (
            <option key={tab} value={tab}>{label}{count > 0 ? ` (${count})` : ''}</option>
          ))}
        </select>
      </div>

      {}
      {(() => {
        const total = Object.values(channelCounts).reduce((sum, n) => sum + n, 0)
        return total > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(channelCounts).filter(([, cnt]) => cnt > 0).sort((a, b) => b[1] - a[1]).map(([ch, cnt]) => (
              <button key={ch} onClick={() => setChannelFilter(channelFilter === ch ? '' : ch)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors ${channelFilter === ch ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-transparent text-slate-500 hover:border-slate-200'}`}>
                <span className="font-medium text-slate-700">{ch}</span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(cnt / total) * 100}%` }} />
                </div>
                <span>{cnt}건</span>
              </button>
            ))}
          </div>
        ) : null
      })()}

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
          {(Object.keys(FRANCHISE_STATUS_LABEL) as FranchiseStatus[]).filter(s => statusCounts[s]).map(s => (
            <option key={s} value={s}>{FRANCHISE_STATUS_LABEL[s]} ({statusCounts[s]})</option>
          ))}
        </select>
        <select value={applicantTypeFilter} onChange={e => setApplicantTypeFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">사업자유형 전체</option>
          {(Object.keys(APPLICANT_TYPE_LABEL) as ApplicantType[]).map(t => (
            <option key={t} value={t}>{APPLICANT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select value={vanFilter} onChange={e => setVanFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">VAN사 전체</option>
          {VAN_COMPANIES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">접수채널 전체</option>
          {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="등록일 시작"
          className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-slate-400 text-xs">~</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="등록일 종료"
          className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="updated_at">최근 수정순</option>
          <option value="created_at">등록일순</option>
          <option value="status">상태순</option>
          <option value="open_date">오픈예정일순</option>
          <option value="install_date">설치발송일순</option>
          <option value="manual">직접 정렬 (드래그)</option>
        </select>
        {(search || statusFilter || applicantTypeFilter || channelFilter || vanFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setApplicantTypeFilter(''); setChannelFilter(''); setVanFilter(''); setDateFrom(''); setDateTo('') }}
            className="text-sm text-slate-400 hover:text-red-500 px-2 py-2 transition-colors">
            초기화
          </button>
        )}
        <button onClick={saveFilterPreset} title="현재 필터 저장"
          className="text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 px-2 py-2 rounded-lg transition-colors">
          저장
        </button>
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {savedFilters.map(f => (
              <span key={f.name}
                className="flex items-center gap-1 text-sm border border-slate-200 rounded-lg pl-2 pr-1 py-1 bg-white">
                <button onClick={() => loadFilterPreset(f)} className="text-slate-600 hover:text-blue-600">
                  {f.name}
                </button>
                <button onClick={() => removeFilterPreset(f.name)} title="프리셋 삭제"
                  className="text-slate-300 hover:text-red-500 px-1">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-slate-500">
            {(search || statusFilter || applicantTypeFilter || channelFilter || vanFilter || dateFrom || dateTo)
              ? <><span className="font-semibold text-slate-800">{filteredRows.length.toLocaleString()}건</span> / 전체 {localRows.length.toLocaleString()}건</>
              : `전체 ${localRows.length.toLocaleString()}건`}
          </div>
          <button onClick={handleExcel}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
            <Download size={14} />엑셀
          </button>
          <button onClick={() => setShowShortcuts(true)} title="단축키 도움말 (?)"
            className="text-sm text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
            ?
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />
            정보 입력
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-slate-200 shadow-lg rounded-xl px-5 py-3">
          <span className="text-sm font-semibold text-blue-700">{selected.size}건 선택됨</span>
          {filteredRows.length > pagedRows.length && selected.size < filteredRows.length && (
            <button onClick={selectAllFiltered} title="체크박스는 이 페이지만 선택합니다. 필터링된 전체를 선택하려면 이 버튼을 누르세요."
              className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
              필터링된 전체 {filteredRows.length.toLocaleString()}건 선택
            </button>
          )}
          <button onClick={() => setBulkStatusModal(true)}
            className="text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-lg transition-colors">
            일괄 상태 변경
          </button>
          <button onClick={() => setBulkAssignModal(true)}
            className="text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors">
            일괄 배정
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors">
            <Trash2 size={14} />
            {deleting ? '삭제 중...' : '선택 삭제'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-slate-500 hover:text-slate-700">
            취소
          </button>
        </div>
      )}

      {showForm && <CreateForm onSubmit={handleCreate} submitting={submitting} onClose={() => setShowForm(false)} />}

      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1250px]" style={{ tableLayout: 'fixed' }}>
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
              <th className="px-1 py-2.5 border-b border-slate-200" />
              <th className="px-3 py-2.5 border-b border-slate-200">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" title="이 페이지 전체 선택 (필터링된 전체가 아님)" />
              </th>
              <th className="px-3 py-2.5 border-b border-slate-200" />
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
                  id={`franchise-row-${row.id}`}
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer ${busyId === row.id ? 'opacity-60' : ''} ${rowDragId === row.id ? 'opacity-40' : ''}`}
                  onClick={() => toggleExpand(row)}
                  onDragOver={e => { if (canReorder && rowDragId) e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); if (rowDragId) reorderRows(rowDragId, row.id) }}
                >
                  <td
                    className={`px-1 py-3 text-slate-700 ${canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30'}`}
                    onClick={e => e.stopPropagation()}
                    draggable={canReorder}
                    onDragStart={e => { if (!canReorder) { e.preventDefault(); return } setRowDragId(row.id) }}
                    onDragEnd={() => setRowDragId(null)}
                    title={canReorder ? '드래그해서 순서 변경' : '"직접 정렬" + 필터 해제 상태에서만 순서를 바꿀 수 있습니다'}
                  >
                    <GripVertical size={14} />
                  </td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {expandedId === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                    <DateField row={row} field="reception_date" onSave={saveField} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select
                      value={row.reception_channel ?? ''}
                      onChange={e => saveField(row, 'reception_channel', e.target.value)}
                      className="text-sm font-medium text-slate-700 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded cursor-pointer"
                    >
                      <option value="">미지정</option>
                      {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select
                      value={row.applicant_type}
                      onChange={e => updateApplicantType(row, e.target.value as ApplicantType)}
                      className="text-xs font-semibold rounded-full pl-2.5 pr-1.5 py-1 border border-slate-200 bg-slate-100 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                    >
                      {(Object.keys(APPLICANT_TYPE_LABEL) as ApplicantType[]).map(t => (
                        <option key={t} value={t}>{APPLICANT_TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis" title={row.business_name || undefined}>
                    <div className="flex items-center gap-1.5">
                      <span>{row.business_name || '-'}</span>
                      {(() => { const pct = completeness(row); return pct < 100 ? (
                        <span className={`text-xs px-1 py-0.5 rounded font-medium ${pct >= 75 ? 'bg-blue-50 text-blue-500' : pct >= 50 ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>{pct}%</span>
                      ) : null })()}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis" title={row.owner_name || undefined}>{row.owner_name || '-'}</td>
                  <td className="px-3 py-3 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
                    {row.phone ? (
                      <button
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(row.phone!); toast.success(`복사됨: ${row.phone}`) }}
                        className="hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                        title="클릭하여 복사"
                      >{row.phone}</button>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis text-xs">{row.creator?.name ?? '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select
                      value={row.cs_id ?? ''}
                      onChange={e => updateCs(row, e.target.value)}
                      className="text-sm font-medium text-slate-700 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded cursor-pointer"
                    >
                      <option value="">미배정</option>
                      {csProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    {localLinkedInternets[row.id] && (
                      <span className="text-sm font-extrabold text-green-700">
                        {localLinkedInternets[row.id].category || 'O'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col gap-1">
                      <select
                        value={row.status}
                        disabled={busyId === row.id}
                        onChange={e => handleStatusChange(row, e.target.value as FranchiseStatus)}
                        className={`text-xs font-semibold rounded-full pl-2.5 pr-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer disabled:opacity-50 ${FRANCHISE_STATUS_COLOR[row.status]}`}
                      >
                        {SELECTABLE_FRANCHISE_STATUSES.map(s => (
                          <option key={s} value={s}>{FRANCHISE_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        {(() => { const d = statusAgeDays(row); return d >= 1 ? (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${d >= 30 ? 'bg-red-100 text-red-600' : d >= 15 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{d}일째</span>
                        ) : null })()}
                        {NEXT_STATUS[row.status] && busyId !== row.id && (
                          <button
                            onClick={() => handleStatusChange(row, NEXT_STATUS[row.status]!)}
                            title={`→ ${FRANCHISE_STATUS_LABEL[NEXT_STATUS[row.status]!]}`}
                            className="text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors"
                          >→</button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 max-w-[200px] truncate" title={row.memo || undefined}>{row.memo || '-'}</td>
                </tr>
                {expandedId === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-blue-50/50 border-b border-slate-100">
                    <td colSpan={14} className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400">상호명</label>
                          <EditableText row={row} field="business_name" placeholder="-" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">대표자명</label>
                          <EditableText row={row} field="owner_name" placeholder="-" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">연락처</label>
                          <EditableText row={row} field="phone" placeholder="010-0000-0000" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">사업자번호</label>
                          <EditableText row={row} field="business_number" placeholder="000-00-00000" onSave={saveField} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-400">상품</label>
                          <EquipmentCart items={row.equipment_items ?? []} onChange={items => saveEquipmentItems(row, items)} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">작업제목</label>
                          <EditableText row={row} field="title" placeholder="-" onSave={saveField} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-400">주소</label>
                          <EditableText row={row} field="address" placeholder="-" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">상세주소</label>
                          <EditableText row={row} field="address_detail" placeholder="-" onSave={saveField} />
                        </div>
                        {row.applicant_type !== 'giga_individual' && row.applicant_type !== 'giga_corporate' && (
                          <div>
                            <label className="text-xs font-semibold text-slate-400">오픈예정일</label>
                            <DateField row={row} field="open_date" onSave={saveField} />
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-semibold text-slate-400">카드가맹접수일</label>
                          <DateField row={row} field="card_apply_date" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">설치 및 발송일</label>
                          <DateField row={row} field="install_date" onSave={saveField} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400">인터넷</label>
                          <select
                            value={row.internet ?? ''}
                            onChange={e => saveField(row, 'internet', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 -mx-1 text-sm"
                          >
                            <option value="">-</option>
                            {INTERNET_PROVIDERS.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-400">VAN사 (중복선택 가능)</label>
                          <VanMultiSelect value={row.van_company ?? ''} onChange={v => saveField(row, 'van_company', v)} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <button onClick={() => shareLink(row.id)}
                          className="text-xs text-slate-400 hover:text-blue-500 border border-slate-200 hover:border-blue-300 px-2 py-1 rounded-lg transition-colors">
                          링크 복사
                        </button>
                        {row.phone && (
                          <button
                            onClick={() => {
                              const dc = docCaseOf(row.owner_name, row.business_name)
                              notifyAndLog(row.id, 'doc_request', { type: 'doc_request', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, applicantType: row.applicant_type, docCase: dc })
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors"
                          >
                            서류안내 재발송
                          </button>
                        )}
                        {localLinkedInstalls[row.id] && localLinkedInstalls[row.id].status !== 'rejected' ? (
                          <button onClick={() => router.push('/installs')}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${
                            localLinkedInstalls[row.id].status === 'completed'
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : 'bg-purple-50 text-purple-600 border-purple-200'
                          }`}>
                            {localLinkedInstalls[row.id].status === 'completed' ? '설치완료 →' : '기술지원 이관됨 →'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            {localLinkedInstalls[row.id]?.status === 'rejected' && (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border bg-red-50 text-red-600 border-red-200">
                                기술지원 반려됨
                              </span>
                            )}
                            <button
                              onClick={() => transferToTech(row)}
                              disabled={transferringId === row.id}
                              className="text-xs font-semibold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {transferringId === row.id ? '처리 중...' :
                               localLinkedInstalls[row.id]?.status === 'rejected' ? '재이관' : '기술지원 이관'}
                            </button>
                          </div>
                        )}
                        {localLinkedInternets[row.id] ? (
                          <button onClick={() => router.push('/internet')}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${
                            localLinkedInternets[row.id].status === '개통완료'
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : localLinkedInternets[row.id].status === '취소'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-cyan-50 text-cyan-600 border-cyan-200'
                          }`}>
                            인터넷 {localLinkedInternets[row.id].status || '등록됨'} →
                          </button>
                        ) : (
                          <button
                            onClick={() => linkToInternet(row)}
                            disabled={linkingInternetId === row.id}
                            className="text-xs font-semibold bg-cyan-600 text-white px-3 py-1.5 rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                          >
                            {linkingInternetId === row.id ? '처리 중...' : '인터넷 등록'}
                          </button>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <HistoryButton onClick={() => setHistoryOpenId(row.id)} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={14} className="text-center text-slate-400 py-10">
                <div className="flex flex-col items-center gap-2">
                  <span>조건에 맞는 가맹 접수가 없습니다.</span>
                  {(search || statusFilter || applicantTypeFilter || channelFilter || vanFilter || dateFrom || dateTo) && (
                    <button
                      onClick={() => { setSearch(''); setStatusFilter(''); setApplicantTypeFilter(''); setChannelFilter(''); setVanFilter(''); setDateFrom(''); setDateTo('') }}
                      className="text-sm text-blue-500 hover:text-blue-700 underline">
                      필터 초기화
                    </button>
                  )}
                </div>
              </td></tr>
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
      {historyOpenId && (() => {
        const row = localRows.find(r => r.id === historyOpenId)
        if (!row) return null
        return (
          <HistoryPanel
            row={row}
            logs={logsByRow[row.id]}
            onSave={saveField}
            onClose={() => setHistoryOpenId(null)}
          />
        )
      })()}
    </div>
  )
}
