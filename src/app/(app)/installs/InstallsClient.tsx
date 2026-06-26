'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Search, RefreshCw, Download } from 'lucide-react'
import type { Profile } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  received: '접수',
  preparing: '제품준비',
  in_transit: '이동중',
  completed: '설치완료',
}
const STATUS_ORDER = ['received', 'preparing', 'in_transit', 'completed']
const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-100 text-gray-600 border-gray-200',
  preparing: 'bg-blue-50 text-blue-600 border-blue-200',
  in_transit: 'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-green-50 text-green-600 border-green-200',
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
}

interface Props {
  profile: Profile
  techUsers: { id: string; name: string }[]
  initialInstalls: Installation[]
}

const PAGE_SIZE = 10

export default function InstallsClient({ profile, techUsers, initialInstalls }: Props) {
  const canEdit = ['tech', 'cs', 'admin'].includes(profile.role)
  const [installs, setInstalls] = useState<Installation[]>(initialInstalls)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailInst, setDetailInst] = useState<Installation | null>(null)
  const [form, setForm] = useState({ customerName: '', customerPhone: '', assignedTo: '', notes: '' })
  const [cartProduct, setCartProduct] = useState(PRODUCT_CATALOG[0])
  const [cartQty, setCartQty] = useState(1)
  const [cartItems, setCartItems] = useState<{ name: string; quantity: number }[]>([])
  const [completeModal, setCompleteModal] = useState<{ id: string; notes: string } | null>(null)
  const [completePhotos, setCompletePhotos] = useState<File[]>([])
  const [completing, setCompleting] = useState(false)

  const supabase = createClient()

  async function fetchInstalls() {
    setLoading(true)
    const { data } = await supabase
      .from('installations')
      .select('*, assignee:profiles!installations_assigned_to_fkey(name), creator:profiles!installations_created_by_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(300)
    setInstalls((data as any) ?? [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerName) return
    setSubmitting(true)
    const { error } = await supabase.from('installations').insert({
      customer_name: form.customerName,
      customer_phone: form.customerPhone || null,
      items: cartItems,
      assigned_to: form.assignedTo || null,
      notes: form.notes || null,
      created_by: profile.id,
      status: 'received',
    })
    setSubmitting(false)
    if (error) { alert('등록 실패: ' + error.message); return }
    setForm({ customerName: '', customerPhone: '', assignedTo: '', notes: '' })
    setCartItems([])
    setShowForm(false)
    fetchInstalls()
  }

  async function handleStatusChange(id: string, status: string) {
    if (status === 'completed') {
      const inst = installs.find(i => i.id === id)
      setCompleteModal({ id, notes: inst?.notes ?? '' })
      setCompletePhotos([])
      return
    }
    await supabase.from('installations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function submitCompletion() {
    if (!completeModal) return
    if (completePhotos.length === 0) { alert('설치완료사진을 최소 1장 첨부해주세요.'); return }
    setCompleting(true)
    const { id, notes } = completeModal

    const photoUrls: string[] = []
    for (const [i, file] of completePhotos.entries()) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${id}/${Date.now()}-${i}.${ext}`
      const { error: uploadError } = await supabase.storage.from('install-photos').upload(path, file)
      if (uploadError) { alert('사진 업로드 실패: ' + uploadError.message); setCompleting(false); return }
      const { data: { publicUrl } } = supabase.storage.from('install-photos').getPublicUrl(path)
      photoUrls.push(publicUrl)
    }

    const { error } = await supabase.from('installations').update({
      status: 'completed',
      notes: notes || null,
      completion_photo_urls: photoUrls,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('완료 처리 실패: ' + error.message); setCompleting(false); return }

    setInstalls(prev => prev.map(i => i.id === id ? { ...i, status: 'completed', notes, completion_photo_urls: photoUrls } : i))
    setCompleteModal(null)
    setCompletePhotos([])
    setCompleting(false)
  }

  async function handleAssign(id: string, assignedTo: string) {
    await supabase.from('installations').update({ assigned_to: assignedTo || null }).eq('id', id)
    fetchInstalls()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('installations').delete().eq('id', id)
    setInstalls(prev => prev.filter(i => i.id !== id))
  }

  function addToCart() {
    setCartItems(prev => {
      const existing = prev.find(i => i.name === cartProduct)
      if (existing) return prev.map(i => i.name === cartProduct ? { ...i, quantity: i.quantity + cartQty } : i)
      return [...prev, { name: cartProduct, quantity: cartQty }]
    })
    setCartQty(1)
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/install-status/${token}`
    navigator.clipboard.writeText(url)
    alert('고객 조회 링크가 복사됐습니다.')
  }

  function handleExcel() {
    import('xlsx').then(XLSX => {
      const rows = filteredInstalls.map(i => ({
        고객명: i.customer_name,
        전화번호: i.customer_phone ?? '',
        제품: i.items.map(it => `${it.name} x${it.quantity}`).join(', '),
        상태: STATUS_LABELS[i.status] ?? i.status,
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

  const filteredInstalls = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return installs
    return installs.filter(i =>
      i.customer_name?.toLowerCase().includes(q) ||
      i.customer_phone?.toLowerCase().includes(q) ||
      i.items?.some(it => it.name.toLowerCase().includes(q))
    )
  }, [installs, search])

  const pagedInstalls = filteredInstalls.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filteredInstalls.length / PAGE_SIZE)

  const thisMonth = installs.filter(i => {
    const d = new Date(i.created_at)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">설치 관리</h1>
          <p className="text-slate-500 text-sm mt-1">이번달 {thisMonth}건 / 전체 {installs.length}건</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExcel} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <Download size={15} />엑셀
          </button>
          <button onClick={fetchInstalls} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <RefreshCw size={15} />
          </button>
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 font-semibold">
              <Plus size={16} />새 설치건
            </button>
          )}
        </div>
      </div>

      {/* 등록 폼 */}
      {canEdit && showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">새 설치건 등록</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">고객명 *</label>
                <input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  className={INPUT} placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">전화번호</label>
                <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
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
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600">취소</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {submitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="고객명, 전화번호, 제품명 검색"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filteredInstalls.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">설치건이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['고객명', '전화번호', '제품', '상태', '담당기사', '비고', '등록일', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedInstalls.map(inst => (
                  <tr key={inst.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{inst.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{inst.customer_phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {inst.items?.length > 0 ? inst.items.map(i => `${i.name} x${i.quantity}`).join(', ') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canEdit ? (
                        <select value={inst.status} onChange={e => handleStatusChange(inst.id, e.target.value)}
                          className={`text-xs font-medium rounded-lg border px-2 py-1 focus:outline-none cursor-pointer ${STATUS_COLORS[inst.status]}`}>
                          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium rounded-lg border px-2 py-1 ${STATUS_COLORS[inst.status]}`}>
                          {STATUS_LABELS[inst.status] ?? inst.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canEdit ? (
                        <select value={inst.assigned_to || ''} onChange={e => handleAssign(inst.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none">
                          <option value="">미배정</option>
                          {techUsers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-500">{inst.assignee?.name ?? '미배정'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                      <span className="text-xs line-clamp-1">{inst.notes || '-'}</span>
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
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {format(new Date(inst.created_at), 'M/d HH:mm', { locale: ko })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button onClick={() => copyLink(inst.status_token)}
                          className="text-xs text-slate-500 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50">링크</button>
                        {(profile.role === 'admin') && (
                          <button onClick={() => handleDelete(inst.id)}
                            className="text-xs text-red-400 border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50">삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
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
                onClick={submitCompletion}
                disabled={completing || completePhotos.length === 0}
                className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >{completing ? '처리 중...' : '완료 처리'}</button>
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
