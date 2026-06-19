'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Ticket } from '@/types'

const RECEPTION_CHANNELS = ['전화', '카카오톡', '문자', '방문', '온라인', '기타']
const DOCUMENT_STATUSES = ['미접수', '일부접수', '완료']
const VAN_COMPANIES = ['KIS', 'NICE', 'KCP', 'KSNET', '한국정보통신', '스마트로', 'JTNET', '기타']
const SIMPLE_PAYMENTS = ['카카오페이', '네이버페이', '페이코', '삼성페이', 'SSG페이', 'L페이', '기타', '없음']

interface Props {
  ticket: Ticket
  canEdit: boolean
}

export default function TicketInfoEdit({ ticket, canEdit }: Props) {
  const [form, setForm] = useState({
    business_type: ticket.business_type ?? '개인',
    reception_channel: ticket.reception_channel ?? '',
    progress_note: ticket.progress_note ?? '',
    document_status: ticket.document_status ?? '미접수',
    internet: ticket.internet ?? '',
    product: ticket.product ?? '',
    card_apply_date: ticket.card_apply_date ?? '',
    van_company: ticket.van_company ?? '',
    baemin_apply: ticket.baemin_apply ?? false,
    simple_payment: ticket.simple_payment ?? '',
    memo: ticket.memo ?? '',
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const save = useCallback(async (key: string, value: string | boolean) => {
    setSaving(key)
    const supabase = createClient()
    await supabase.from('tickets').update({ [key]: value || null }).eq('id', ticket.id)
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 1500)
  }, [ticket.id])

  function handleChange(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
    if (typeof value === 'boolean') save(key, value)
  }

  function handleBlur(key: string) {
    save(key, form[key as keyof typeof form] as string)
  }

  const INPUT = `w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm text-slate-900 focus:outline-none focus:border-blue-400 transition-colors ${canEdit ? '' : 'pointer-events-none'}`
  const SELECT = `w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm text-slate-900 focus:outline-none focus:border-blue-400 transition-colors ${canEdit ? '' : 'pointer-events-none'}`

  function StatusDot({ field }: { field: string }) {
    if (saving === field) return <span className="text-[10px] text-slate-400 ml-1">저장중...</span>
    if (saved === field) return <span className="text-[10px] text-blue-500 ml-1">✓ 저장됨</span>
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">영업 / CS 정보</h2>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* 사업자 구분 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">사업자 구분 <StatusDot field="business_type" /></p>
          <select value={form.business_type} disabled={!canEdit}
            onChange={e => { handleChange('business_type', e.target.value); save('business_type', e.target.value) }}
            className={SELECT}>
            <option value="개인">개인사업자</option>
            <option value="법인">법인사업자</option>
          </select>
        </div>

        {/* 접수 채널 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">접수 채널 <StatusDot field="reception_channel" /></p>
          <select value={form.reception_channel} disabled={!canEdit}
            onChange={e => { handleChange('reception_channel', e.target.value); save('reception_channel', e.target.value) }}
            className={SELECT}>
            <option value="">선택</option>
            {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* 서류 접수 상태 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">서류 접수 상태 <StatusDot field="document_status" /></p>
          <select value={form.document_status} disabled={!canEdit}
            onChange={e => { handleChange('document_status', e.target.value); save('document_status', e.target.value) }}
            className={SELECT}>
            {DOCUMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 상품 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">상품 <StatusDot field="product" /></p>
          <input value={form.product} disabled={!canEdit}
            onChange={e => handleChange('product', e.target.value)}
            onBlur={() => handleBlur('product')}
            className={INPUT} placeholder="예: 포스 단말기" />
        </div>

        {/* VAN사 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">VAN사 <StatusDot field="van_company" /></p>
          <select value={form.van_company} disabled={!canEdit}
            onChange={e => { handleChange('van_company', e.target.value); save('van_company', e.target.value) }}
            className={SELECT}>
            <option value="">선택</option>
            {VAN_COMPANIES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* 인터넷 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">인터넷 <StatusDot field="internet" /></p>
          <input value={form.internet} disabled={!canEdit}
            onChange={e => handleChange('internet', e.target.value)}
            onBlur={() => handleBlur('internet')}
            className={INPUT} placeholder="예: KT, SKT" />
        </div>

        {/* 카드가맹 접수일 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">카드가맹 접수일 <StatusDot field="card_apply_date" /></p>
          <input type="date" value={form.card_apply_date} disabled={!canEdit}
            onChange={e => { handleChange('card_apply_date', e.target.value); save('card_apply_date', e.target.value) }}
            className={INPUT} />
        </div>

        {/* 간편결제 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">간편결제 <StatusDot field="simple_payment" /></p>
          <select value={form.simple_payment} disabled={!canEdit}
            onChange={e => { handleChange('simple_payment', e.target.value); save('simple_payment', e.target.value) }}
            className={SELECT}>
            <option value="">선택</option>
            {SIMPLE_PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* 배민접수 */}
        <div className="col-span-2">
          <p className="text-xs text-gray-400 mb-1">배민접수 <StatusDot field="baemin_apply" /></p>
          <label className={`flex items-center gap-2 mt-1 ${canEdit ? 'cursor-pointer' : 'pointer-events-none'}`}>
            <input type="checkbox" checked={form.baemin_apply} disabled={!canEdit}
              onChange={e => handleChange('baemin_apply', e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">배민 접수됨</span>
          </label>
        </div>
      </div>

      {/* 진행 상황 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1">진행 상황 <StatusDot field="progress_note" /></p>
        <textarea value={form.progress_note} disabled={!canEdit} rows={2}
          onChange={e => handleChange('progress_note', e.target.value)}
          onBlur={() => handleBlur('progress_note')}
          className="w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm text-slate-900 focus:outline-none focus:border-blue-400 transition-colors resize-none"
          placeholder="현재 진행 상황" />
      </div>

      {/* 비고 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1">비고 <StatusDot field="memo" /></p>
        <textarea value={form.memo} disabled={!canEdit} rows={2}
          onChange={e => handleChange('memo', e.target.value)}
          onBlur={() => handleBlur('memo')}
          className="w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm text-slate-900 focus:outline-none focus:border-blue-400 transition-colors resize-none"
          placeholder="비고" />
      </div>
    </div>
  )
}
