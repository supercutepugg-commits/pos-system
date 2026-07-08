'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { TYPE_LABEL, STATUS_LABEL, STATUS_COLOR, type TicketStatus, type TicketType } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface CalendarTicket {
  id: string
  title: string
  type: string
  status: string
  scheduled_at?: string | null
  install_date?: string | null
  open_date?: string | null
  card_apply_date?: string | null
  merchant?: { business_name: string } | null
  tech?: { name: string } | null
  sales?: { name: string } | null
}

interface CalendarFranchiseRow {
  id: string
  business_name?: string | null
  status: string
  open_date?: string | null
  install_date?: string | null
  sales?: { name: string } | null
}

interface CalendarWooRow {
  id: string
  business_name?: string | null
  manager?: string | null
  open_date?: string | null
}

interface CalendarManualEvent {
  id: string
  date: string
  title: string
  memo?: string | null
}

interface CalendarEvent {
  date: string    // YYYY-MM-DD
  label: string   // 어떤 날짜인지
  color: string
  href: string
  businessName: string
  subtitle: string
  statusLabel?: string
  statusColor?: string
  type?: TicketType
  techName?: string
  salesName?: string
  glow?: boolean
  manualId?: string
}

const EVENT_TYPES = [
  { key: 'scheduled_at',    label: '일정',    color: 'bg-indigo-500' },
  { key: 'install_date',    label: '설치',    color: 'bg-emerald-500' },
  { key: 'open_date',       label: '오픈',    color: 'bg-blue-500' },
  { key: 'card_apply_date', label: '카드신청', color: 'bg-orange-500' },
] as const

const FRANCHISE_EVENT_TYPES = [
  { key: 'open_date',    label: '오픈예정일', color: 'bg-sky-500' },
  { key: 'install_date', label: '설치예정일', color: 'bg-teal-500' },
] as const

const WOO_EVENT_LEGEND = [
  { key: 'open_date',    label: '우국상 오픈',       color: 'bg-cyan-500' },
  { key: 'install_date', label: '우국상 설치(월요일)', color: 'bg-amber-500' },
] as const

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toYMD(s: string | null | undefined): string | null {
  if (!s) return null
  return s.slice(0, 10)
}

// 오픈일이 속한 주의 월요일 (설치는 오픈 주 월요일에 진행)
function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay() // 0=일 ~ 6=토
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function CalendarClient({ tickets, franchiseRows = [], wooRows = [], manualEvents = [] }: { tickets: CalendarTicket[]; franchiseRows?: CalendarFranchiseRow[]; wooRows?: CalendarWooRow[]; manualEvents?: CalendarManualEvent[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [localManualEvents, setLocalManualEvents] = useState(manualEvents)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const handleAddEvent = useCallback(async () => {
    if (!selectedDate || !newTitle.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({ date: selectedDate, title: newTitle.trim(), memo: newMemo.trim() || null })
      .select('id, date, title, memo')
      .single()
    setSubmitting(false)
    if (error) { toast.error('일정 등록 실패: ' + error.message); return }
    setLocalManualEvents(prev => [...prev, data as CalendarManualEvent])
    setNewTitle('')
    setNewMemo('')
    setShowAddForm(false)
  }, [selectedDate, newTitle, newMemo, toast])

  const handleDeleteEvent = useCallback(async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) { toast.error('일정 삭제 실패: ' + error.message); return }
    setLocalManualEvents(prev => prev.filter(e => e.id !== id))
  }, [toast])

  // 이벤트 맵: YYYY-MM-DD → CalendarEvent[]
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ticket of tickets) {
      for (const et of EVENT_TYPES) {
        const date = toYMD(ticket[et.key as keyof CalendarTicket] as string)
        if (!date) continue
        if (!map[date]) map[date] = []
        map[date].push({
          date,
          label: et.label,
          color: et.color,
          href: `/tickets/${ticket.id}`,
          businessName: ticket.merchant?.business_name ?? ticket.title,
          subtitle: ticket.title,
          statusLabel: STATUS_LABEL[ticket.status as TicketStatus],
          statusColor: STATUS_COLOR[ticket.status as TicketStatus],
          type: ticket.type as TicketType,
          techName: ticket.tech?.name,
          salesName: ticket.sales?.name,
        })
      }
    }
    for (const row of franchiseRows) {
      for (const et of FRANCHISE_EVENT_TYPES) {
        const date = toYMD(row[et.key as keyof CalendarFranchiseRow] as string)
        if (!date) continue
        if (!map[date]) map[date] = []
        map[date].push({
          date,
          label: et.label,
          color: et.color,
          href: '/franchise',
          businessName: row.business_name || '상호명 미입력',
          subtitle: '가맹 접수',
          salesName: row.sales?.name,
        })
      }
    }
    for (const row of wooRows) {
      const openDate = row.open_date && ISO_DATE_RE.test(row.open_date) ? row.open_date : null
      if (!openDate) continue
      const businessName = row.business_name || '상호명 미입력'
      if (!map[openDate]) map[openDate] = []
      map[openDate].push({
        date: openDate,
        label: '오픈',
        color: 'bg-cyan-500',
        href: '/woo',
        businessName,
        subtitle: '우국상 오픈',
        salesName: row.manager ?? undefined,
      })
      const installDate = mondayOfWeek(openDate)
      if (!map[installDate]) map[installDate] = []
      map[installDate].push({
        date: installDate,
        label: '설치',
        color: 'bg-amber-500',
        href: '/woo',
        businessName,
        subtitle: '우국상 설치 (오픈 주 월요일)',
        salesName: row.manager ?? undefined,
        glow: true,
      })
    }
    for (const ev of localManualEvents) {
      const date = toYMD(ev.date)
      if (!date) continue
      if (!map[date]) map[date] = []
      map[date].push({
        date,
        label: '메모',
        color: 'bg-violet-500',
        href: '',
        businessName: ev.title,
        subtitle: ev.memo || '',
        manualId: ev.id,
      })
    }
    return map
  }, [tickets, franchiseRows, wooRows, localManualEvents])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDate(null)
  }

  // 달력 날짜 계산
  const firstDay = new Date(year, month, 1).getDay()  // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // 6주 맞추기
  while (cells.length % 7 !== 0) cells.push(null)

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] ?? []) : []

  // 이번달 총 이벤트 수
  const monthTotal = Object.entries(eventMap).filter(([d]) =>
    d.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)
  ).reduce((s, [, evs]) => s + evs.length, 0)

  return (
    <div className="flex gap-4 h-full">
      {/* 캘린더 본체 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 min-w-[120px] text-center">
            {year}년 {month + 1}월
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={18} className="text-slate-500" />
          </button>
          <button onClick={goToday} className="ml-2 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
            오늘
          </button>
          <span className="ml-auto text-sm text-slate-400">이번달 일정 {monthTotal}건</span>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 flex-1 border-t border-l border-slate-200 rounded-xl overflow-hidden">
          {cells.map((day, idx) => {
            if (!day) return (
              <div key={`empty-${idx}`} className="border-b border-r border-slate-200 bg-slate-50/50 min-h-[90px]" />
            )
            const ds = dateStr(day)
            const events = eventMap[ds] ?? []
            const isToday = ds === todayStr
            const isSelected = ds === selectedDate
            const dow = (firstDay + day - 1) % 7
            return (
              <div
                key={ds}
                onClick={() => setSelectedDate(isSelected ? null : ds)}
                className={`border-b border-r border-slate-200 min-h-[90px] p-1.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 ${
                  isToday ? 'bg-blue-600 text-white' :
                  dow === 0 ? 'text-red-500' :
                  dow === 6 ? 'text-blue-500' :
                  'text-slate-700'
                }`}>
                  {day}
                </div>
                <div className="flex flex-col gap-0.5">
                  {events.slice(0, 3).map((ev, i) => (
                    <div key={i} className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${ev.color} ${
                      ev.glow ? 'ring-2 ring-amber-300 shadow-[0_0_8px_2px_rgba(245,158,11,0.75)] animate-pulse' : ''
                    }`}>
                      {ev.label} {ev.businessName}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-slate-400 px-1">+{events.length - 3}건</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-3 mt-3">
          {[...EVENT_TYPES, ...FRANCHISE_EVENT_TYPES, ...WOO_EVENT_LEGEND, { key: 'manual', label: '메모', color: 'bg-violet-500' }].map(et => (
            <div key={et.key + et.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-sm ${et.color}`} />
              {et.label}
            </div>
          ))}
        </div>
      </div>

      {/* 선택된 날짜 패널 */}
      <div className={`w-72 flex-shrink-0 transition-all ${selectedDate ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {selectedDate && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm h-fit">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">
                {selectedDate.slice(5).replace('-', '/')} 일정
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <Plus size={12} /> 일정 추가
                </button>
                <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={15} />
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEvent() }}
                  placeholder="일정 제목"
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
                />
                <input
                  value={newMemo}
                  onChange={e => setNewMemo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEvent() }}
                  placeholder="메모 (선택)"
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowAddForm(false); setNewTitle(''); setNewMemo('') }} className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-50">
                    취소
                  </button>
                  <button
                    onClick={handleAddEvent}
                    disabled={submitting || !newTitle.trim()}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    등록
                  </button>
                </div>
              </div>
            )}

            {selectedEvents.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">일정 없음</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {selectedEvents.map((ev, i) => {
                  const content = (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded ${ev.color} ${
                          ev.glow ? 'ring-2 ring-amber-300 shadow-[0_0_8px_2px_rgba(245,158,11,0.75)] animate-pulse' : ''
                        }`}>
                          {ev.label}
                        </span>
                        {ev.statusLabel && ev.statusColor && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.statusColor}`}>
                            {ev.statusLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {ev.businessName}
                      </p>
                      {ev.subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{ev.subtitle}</p>}
                      <div className="flex gap-2 mt-1 text-xs text-slate-400">
                        {ev.type && <span>{TYPE_LABEL[ev.type]}</span>}
                        {ev.techName && <span>· {ev.techName}</span>}
                        {ev.salesName && <span>· {ev.salesName}</span>}
                      </div>
                    </>
                  )
                  if (ev.manualId) {
                    return (
                      <div key={i} className="flex items-start px-4 py-3 hover:bg-slate-50 transition-colors group">
                        <div className="flex-1 min-w-0">{content}</div>
                        <button
                          onClick={() => handleDeleteEvent(ev.manualId!)}
                          className="text-slate-300 hover:text-red-500 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  }
                  return (
                    <Link key={i} href={ev.href}
                      className="block px-4 py-3 hover:bg-slate-50 transition-colors">
                      {content}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
