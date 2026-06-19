'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface InboundRow {
  id: string
  date: string | null
  staff: string | null
  channel: string | null
  category: string | null
  status: string | null
  owner_name: string | null
  business_name: string | null
  phone: string | null
  inquiry: string | null
  answer: string | null
  chat_log: string | null
  ai_summary: string | null
  tech_note: string | null
  note: string | null
}

const CHANNEL_COLORS: Record<string, string> = {
  '유선': 'bg-blue-100 text-blue-700',
  '채널톡': 'bg-emerald-100 text-emerald-700',
  '채널': 'bg-emerald-100 text-emerald-700',
  '슬랙': 'bg-purple-100 text-purple-700',
  '기타': 'bg-slate-100 text-slate-600',
}
const STATUS_COLORS: Record<string, string> = {
  '처리완료': 'bg-emerald-100 text-emerald-700',
  '단순문의': 'bg-emerald-50 text-emerald-600',
  '처리중': 'bg-blue-100 text-blue-700',
  '원격 진행중': 'bg-blue-100 text-blue-700',
  '처리대기': 'bg-yellow-100 text-yellow-700',
  '미처리': 'bg-red-100 text-red-700',
  '보류': 'bg-slate-100 text-slate-600',
  '발송대기': 'bg-orange-100 text-orange-700',
  '포스기 일정': 'bg-indigo-100 text-indigo-700',
  '인터넷 일정': 'bg-indigo-100 text-indigo-700',
  '카드가맹 일정': 'bg-indigo-100 text-indigo-700',
  '신규': 'bg-pink-100 text-pink-700',
  '기존': 'bg-slate-100 text-slate-600',
  '기타': 'bg-slate-100 text-slate-600',
}
const CATEGORY_COLORS: Record<string, string> = {
  'A/S': 'bg-red-100 text-red-700',
  '가입문의': 'bg-blue-100 text-blue-700',
  '일정문의': 'bg-indigo-100 text-indigo-700',
  '메뉴수정': 'bg-amber-100 text-amber-700',
  '매뉴수정': 'bg-amber-100 text-amber-700',
  '용지요청': 'bg-teal-100 text-teal-700',
  '기타문의': 'bg-slate-100 text-slate-600',
}

type SortKey = keyof InboundRow
type SortDir = 'asc' | 'desc'

export default function InboundClient({ rows }: { rows: InboundRow[] }) {
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const staffs = useMemo(() => [...new Set(rows.map(r => r.staff).filter(Boolean))].sort() as string[], [rows])
  const channels = useMemo(() => [...new Set(rows.map(r => r.channel).filter(Boolean))].sort() as string[], [rows])
  const categories = useMemo(() => [...new Set(rows.map(r => r.category).filter(Boolean))].sort() as string[], [rows])
  const statuses = useMemo(() => [...new Set(rows.map(r => r.status).filter(Boolean))].sort() as string[], [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.business_name?.toLowerCase().includes(q) ||
        r.owner_name?.toLowerCase().includes(q) ||
        r.phone?.includes(q) ||
        r.inquiry?.toLowerCase().includes(q) ||
        r.staff?.toLowerCase().includes(q)
      )
    }
    if (staffFilter) result = result.filter(r => r.staff === staffFilter)
    if (channelFilter) result = result.filter(r => r.channel === channelFilter)
    if (categoryFilter) result = result.filter(r => r.category === categoryFilter)
    if (statusFilter) result = result.filter(r => r.status === statusFilter)
    if (dateFrom) result = result.filter(r => r.date && r.date >= dateFrom)
    if (dateTo) result = result.filter(r => r.date && r.date <= dateTo)

    return [...result].sort((a, b) => {
      // null을 항상 뒤로
      if (!a[sortKey] && !b[sortKey]) return 0
      if (!a[sortKey]) return 1
      if (!b[sortKey]) return -1
      const va = a[sortKey]!
      const vb = b[sortKey]!
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, staffFilter, channelFilter, categoryFilter, statusFilter, dateFrom, dateTo, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-blue-500" />
      : <ChevronDown size={13} className="text-blue-500" />
  }

  function Badge({ text, colorMap }: { text: string | null; colorMap: Record<string, string> }) {
    if (!text) return <span className="text-slate-300">-</span>
    const cls = colorMap[text] || 'bg-slate-100 text-slate-600'
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{text}</span>
  }

  return (
    <div className="flex flex-col h-full">
      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상호명, 대표자, 연락처, 문의내용..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">담당자 전체</option>
          {staffs.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">인입채널 전체</option>
          {channels.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">분류 전체</option>
          {categories.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">진행상황 전체</option>
          {statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-slate-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(search || staffFilter || channelFilter || categoryFilter || statusFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStaffFilter(''); setChannelFilter(''); setCategoryFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('') }}
            className="text-sm text-slate-400 hover:text-red-500 px-2 py-2 transition-colors">
            초기화
          </button>
        )}
        <div className="ml-auto text-sm text-slate-500 flex items-center">
          {filtered.length.toLocaleString()}건 / 전체 {rows.length.toLocaleString()}건
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[1200px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {([
                ['date', '날짜', 90],
                ['staff', '담당자', 70],
                ['channel', '인입채널', 80],
                ['category', '분류', 80],
                ['status', '진행상황', 90],
                ['owner_name', '대표자명', 80],
                ['business_name', '상호명', 110],
                ['phone', '연락처', 110],
                ['inquiry', '문의내용', null],
                ['answer', '답변내용', null],
              ] as [SortKey, string, number | null][]).map(([key, label, w]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                  style={w ? { width: w, minWidth: w } : { minWidth: 150 }}
                >
                  <span className="flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <>
                <tr
                  key={row.id}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                    {row.date ? row.date.slice(0, 10) : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.staff || '-'}</td>
                  <td className="px-3 py-2">
                    <Badge text={row.channel} colorMap={CHANNEL_COLORS} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge text={row.category} colorMap={CATEGORY_COLORS} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge text={row.status} colorMap={STATUS_COLORS} />
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.owner_name || '-'}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{row.business_name || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-[250px]">
                    <div className="truncate">{row.inquiry || '-'}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[250px]">
                    <div className="truncate">{row.answer || '-'}</div>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-blue-50">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">문의내용</p>
                          <p className="text-slate-600 whitespace-pre-wrap">{row.inquiry || '-'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">답변내용</p>
                          <p className="text-slate-600 whitespace-pre-wrap">{row.answer || '-'}</p>
                        </div>
                        {row.tech_note && (
                          <div>
                            <p className="font-semibold text-slate-700 mb-1">추가내용 (기술적)</p>
                            <p className="text-slate-600 whitespace-pre-wrap">{row.tech_note}</p>
                          </div>
                        )}
                        {row.note && (
                          <div>
                            <p className="font-semibold text-slate-700 mb-1">비고</p>
                            <p className="text-slate-600 whitespace-pre-wrap">{row.note}</p>
                          </div>
                        )}
                        {row.ai_summary && (
                          <div className="col-span-2">
                            <p className="font-semibold text-slate-700 mb-1">AI 요약</p>
                            <p className="text-slate-600 whitespace-pre-wrap">{row.ai_summary}</p>
                          </div>
                        )}
                        {row.chat_log && (
                          <div className="col-span-2">
                            <p className="font-semibold text-slate-700 mb-1">대화 원본</p>
                            <p className="text-slate-500 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{row.chat_log}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-400">
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
