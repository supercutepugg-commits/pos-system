'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Search, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const CATEGORY_TREE: Record<string, Record<string, string[]>> = {
  '포스장비': {
    '포스기': [
      'J100 화이트', 'J100 블랙', 'J200 화이트', 'J200 블랙',
      'T100 화이트', 'T100 블랙', 'T200 화이트', 'T200 블랙',
      'G250 화이트', 'G250 블랙', '윙포스 화이트',
    ],
  },
  '주변기기': {
    '영수증프린터': ['ZPP-3000 화이트', 'ZPP-3000 블랙'],
    '금전함': ['금전함'],
    '테블릿 PC': ['테블릿 PC'],
    '테이블 오더 브라켓': ['테이블 오더 브라켓'],
    '핸드스캐너': ['핸드스캐너'],
  },
  '결제장비': {
    '프론트': ['프론트'],
    '카드리더기': ['코세스/코밴 SDR-300'],
    '블루투스 스와이프 단말기': ['코세스/코밴 KRE-C100+'],
  },
}
const MAJOR_CATEGORIES = Object.keys(CATEGORY_TREE)

interface InventoryItem {
  id: string
  name: string
  major_category: string
  mid_category: string
  category: string
  quantity: number
  unit: string
  min_quantity: number
  location: string
  notes: string
  last_checked: string
  created_at: string
}

interface InventoryLog {
  id: string
  item_id: string
  item_name: string
  change: number
  reason: string
  user: { name: string } | null
  created_at: string
}

const EMPTY_FORM = {
  major_category: MAJOR_CATEGORIES[0],
  mid_category: Object.keys(CATEGORY_TREE[MAJOR_CATEGORIES[0]])[0],
  category: CATEGORY_TREE[MAJOR_CATEGORIES[0]][Object.keys(CATEGORY_TREE[MAJOR_CATEGORIES[0]])[0]][0],
  quantity: 0,
  unit: '개',
  min_quantity: 0,
  location: '',
  notes: '',
}

export default function InventoryClient({
  initialItems,
  initialLogs,
  currentUserRole,
  currentUserName,
}: {
  initialItems: InventoryItem[]
  initialLogs: InventoryLog[]
  currentUserRole: string
  currentUserName: string
}) {
  const canEdit = ['admin', 'tech'].includes(currentUserRole)
  const [items, setItems] = useState(initialItems)
  const [logs, setLogs] = useState(initialLogs)
  const [search, setSearch] = useState('')
  const [majorFilter, setMajorFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [adjustModal, setAdjustModal] = useState<{ item: InventoryItem; delta: number; reason: string } | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; value: string } | null>(null)

  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category) return
    setSubmitting(true)
    const { data, error } = await supabase.from('inventory_items').insert({
      name: form.category,
      major_category: form.major_category,
      mid_category: form.mid_category,
      category: form.category,
      quantity: form.quantity,
      unit: form.unit || '개',
      min_quantity: form.min_quantity,
      location: form.location || null,
      notes: form.notes || null,
      last_checked: new Date().toISOString().slice(0, 10),
    }).select('*').single()
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setItems(prev => [...prev, data])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  async function handleAdjust() {
    if (!adjustModal) return
    const { item, delta, reason } = adjustModal
    const newQty = Math.max(0, item.quantity + delta)
    const { error } = await supabase.from('inventory_items').update({
      quantity: newQty,
      last_checked: new Date().toISOString().slice(0, 10),
    }).eq('id', item.id)
    if (error) { alert('수량 변경 실패: ' + error.message); return }

    await supabase.from('inventory_logs').insert({
      item_id: item.id,
      item_name: item.name,
      change: delta,
      reason: reason || null,
    })

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty, last_checked: new Date().toISOString().slice(0, 10) } : i))
    setLogs(prev => [{
      id: crypto.randomUUID(),
      item_id: item.id,
      item_name: item.name,
      change: delta,
      reason,
      user: { name: currentUserName },
      created_at: new Date().toISOString(),
    }, ...prev])
    setAdjustModal(null)
  }

  async function saveInlineQty(item: InventoryItem, newQtyStr: string) {
    setInlineEdit(null)
    const newQty = Math.max(0, Number(newQtyStr))
    if (isNaN(newQty) || newQty === item.quantity) return
    const delta = newQty - item.quantity
    const { error } = await supabase.from('inventory_items').update({
      quantity: newQty,
      last_checked: new Date().toISOString().slice(0, 10),
    }).eq('id', item.id)
    if (error) return
    await supabase.from('inventory_logs').insert({
      item_id: item.id,
      item_name: item.name,
      change: delta,
      reason: '직접 수정',
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty, last_checked: new Date().toISOString().slice(0, 10) } : i))
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', id)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = useMemo(() => {
    const result = items.filter(item => {
      if (majorFilter && item.major_category !== majorFilter) return false
      if (lowStockOnly && item.quantity > item.min_quantity) return false
      const term = search.trim().toLowerCase()
      if (term && !`${item.name} ${item.major_category} ${item.mid_category} ${item.category} ${item.location}`.toLowerCase().includes(term)) return false
      return true
    })
    // 부족 품목 상단 자동 정렬
    return result.sort((a, b) => {
      const aLow = a.quantity <= a.min_quantity ? 0 : 1
      const bLow = b.quantity <= b.min_quantity ? 0 : 1
      return aLow - bLow
    })
  }, [items, search, majorFilter, lowStockOnly])

  const lowCount = items.filter(i => i.quantity <= i.min_quantity).length

  const grouped = useMemo(() => {
    const g: Record<string, Record<string, InventoryItem[]>> = {}
    for (const item of filtered) {
      const major = item.major_category || '기타'
      const mid = item.mid_category || item.category
      if (!g[major]) g[major] = {}
      if (!g[major][mid]) g[major][mid] = []
      g[major][mid].push(item)
    }
    return g
  }, [filtered])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">재고 실사</h1>
          <p className="text-sm text-slate-500 mt-0.5">장비 및 소모품 재고를 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLogs(v => !v)}
            className="text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
            {showLogs ? '재고 목록' : '변동 이력'}
          </button>
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
              <Plus size={15} />품목 등록
            </button>
          )}
        </div>
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>{lowCount}개 품목</strong>의 재고가 최소 수량 이하입니다. 확인이 필요합니다.</span>
          <button onClick={() => setLowStockOnly(true)} className="ml-auto text-xs underline">보기</button>
        </div>
      )}

      {showForm && canEdit && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">대분류</label>
            <select value={form.major_category} onChange={e => {
              const major = e.target.value
              const mid = Object.keys(CATEGORY_TREE[major])[0]
              const minor = CATEGORY_TREE[major][mid][0]
              setForm({ ...form, major_category: major, mid_category: mid, category: minor })
            }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MAJOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">중분류</label>
            <select value={form.mid_category} onChange={e => {
              const mid = e.target.value
              const minor = CATEGORY_TREE[form.major_category][mid][0]
              setForm({ ...form, mid_category: mid, category: minor })
            }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.keys(CATEGORY_TREE[form.major_category]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">소분류</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CATEGORY_TREE[form.major_category][form.mid_category].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">현재 수량</label>
            <input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">단위</label>
            <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="개"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">최소 수량 (경고)</label>
            <input type="number" min={0} value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: Number(e.target.value) })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">보관 위치</label>
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="예: 창고 A-3"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">비고</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={submitting}
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg">
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      )}

      {showLogs ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">재고 변동 이력</p>
          </div>
          <div className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">변동 이력이 없습니다.</p>
            ) : logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`text-sm font-bold w-12 text-right ${log.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {log.change > 0 ? `+${log.change}` : log.change}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{log.item_name}</p>
                  {log.reason && <p className="text-xs text-slate-500">{log.reason}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{log.user?.name ?? '알수없음'}</p>
                  <p className="text-xs text-slate-400">{format(new Date(log.created_at), 'M/d HH:mm', { locale: ko })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="품목명, 위치..."
                className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={majorFilter} onChange={e => setMajorFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">분류 전체</option>
              {MAJOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              부족 품목만
            </label>
            <span className="ml-auto text-sm text-slate-500">{filtered.length}개 품목</span>
          </div>

          {Object.entries(grouped).map(([major, midGroups]) => (
            <div key={major} className="mb-6">
              <h2 className="text-sm font-bold text-slate-700 mb-2">{major}</h2>
              {Object.entries(midGroups).map(([mid, catItems]) => (
                <div key={mid} className="mb-5 pl-1">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{mid}</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      {['품목명', '수량', '위치', '마지막 실사', '비고', ''].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map(item => {
                      const isLow = item.quantity <= item.min_quantity
                      return (
                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-900">{item.name}</td>
                          <td className="px-3 py-2.5">
                            {canEdit && inlineEdit?.id === item.id ? (
                              <input
                                autoFocus
                                type="number"
                                min={0}
                                value={inlineEdit.value}
                                onChange={e => setInlineEdit({ id: item.id, value: e.target.value })}
                                onBlur={() => saveInlineQty(item, inlineEdit.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveInlineQty(item, inlineEdit.value); if (e.key === 'Escape') setInlineEdit(null) }}
                                className="w-20 border border-blue-300 rounded px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            ) : (
                              <span
                                className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-900'} ${canEdit ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={() => canEdit && setInlineEdit({ id: item.id, value: String(item.quantity) })}
                                title={canEdit ? '클릭하여 수량 직접 수정' : undefined}
                              >
                                {item.quantity}{item.unit}
                              </span>
                            )}
                            {item.min_quantity > 0 && (
                              <span className="text-xs text-slate-400 ml-1">(최소 {item.min_quantity})</span>
                            )}
                            {isLow && <AlertTriangle size={13} className="inline ml-1 text-red-500" />}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{item.location || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs">{item.last_checked || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-400 max-w-[150px] truncate">{item.notes || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setAdjustModal({ item, delta: 1, reason: '' })}
                                  className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                                  +입고
                                </button>
                                <button
                                  onClick={() => setAdjustModal({ item, delta: -1, reason: '' })}
                                  className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100">
                                  -출고
                                </button>
                                <button onClick={() => deleteItem(item.id, item.name)}
                                  className="text-slate-300 hover:text-red-500 p-1 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
                </div>
              ))}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-slate-400 py-12">
              등록된 품목이 없습니다.
            </div>
          )}
        </>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">
              {adjustModal.delta > 0 ? '입고' : '출고'}: {adjustModal.item.name}
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">수량</label>
              <input
                type="number" min={1}
                value={Math.abs(adjustModal.delta)}
                onChange={e => setAdjustModal(prev => prev ? { ...prev, delta: (prev.delta > 0 ? 1 : -1) * Math.max(1, Number(e.target.value)) } : null)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">사유</label>
              <input
                value={adjustModal.reason}
                onChange={e => setAdjustModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                placeholder="예: 설치 출고, 반납..."
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-slate-400">
              현재 {adjustModal.item.quantity}{adjustModal.item.unit} →{' '}
              <strong>{Math.max(0, adjustModal.item.quantity + adjustModal.delta)}{adjustModal.item.unit}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleAdjust}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                확정
              </button>
              <button onClick={() => setAdjustModal(null)}
                className="w-full py-2 rounded-lg text-slate-400 text-sm hover:text-slate-600">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
