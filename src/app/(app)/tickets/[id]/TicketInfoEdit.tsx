'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, X, Check } from 'lucide-react'
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
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
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

  function set(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('tickets').update({
      business_type: form.business_type,
      reception_channel: form.reception_channel || null,
      progress_note: form.progress_note || null,
      document_status: form.document_status,
      internet: form.internet || null,
      product: form.product || null,
      card_apply_date: form.card_apply_date || null,
      van_company: form.van_company || null,
      baemin_apply: form.baemin_apply,
      simple_payment: form.simple_payment || null,
      memo: form.memo || null,
    }).eq('id', ticket.id)

    setSaving(false)
    if (error) { alert('저장 실패: ' + error.message); return }
    setEditing(false)
    router.refresh()
  }

  const rows: { label: string; key: keyof typeof form; type?: string; options?: string[] }[] = [
    { label: '사업자 구분', key: 'business_type', type: 'select', options: ['개인', '법인'] },
    { label: '접수 채널', key: 'reception_channel', type: 'select', options: RECEPTION_CHANNELS },
    { label: '서류 접수 상태', key: 'document_status', type: 'select', options: DOCUMENT_STATUSES },
    { label: '상품', key: 'product' },
    { label: 'VAN사', key: 'van_company', type: 'select', options: VAN_COMPANIES },
    { label: '인터넷', key: 'internet' },
    { label: '카드가맹 접수일', key: 'card_apply_date', type: 'date' },
    { label: '간편결제', key: 'simple_payment', type: 'select', options: SIMPLE_PAYMENTS },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">영업 / CS 정보</h2>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            <Pencil size={13} />수정
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={13} />취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Check size={13} />{saving ? '저장중...' : '저장'}
            </button>
          </div>
        )}
      </div>

      {/* 2열 그리드 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(({ label, key, type, options }) => (
          <div key={key}>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            {editing ? (
              type === 'select' ? (
                <select value={String(form[key])} onChange={e => set(key, e.target.value)}
                  className={INPUT}>
                  <option value="">선택</option>
                  {options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : type === 'date' ? (
                <input type="date" value={String(form[key])} onChange={e => set(key, e.target.value)} className={INPUT} />
              ) : (
                <input type="text" value={String(form[key])} onChange={e => set(key, e.target.value)} className={INPUT} />
              )
            ) : (
              <p className="text-sm font-medium text-gray-900">{String(form[key] || '-')}</p>
            )}
          </div>
        ))}

        {/* 배민접수 */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">배민접수</p>
          {editing ? (
            <label className="flex items-center gap-2 cursor-pointer mt-1.5">
              <input type="checkbox" checked={form.baemin_apply}
                onChange={e => set('baemin_apply', e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">배민 접수됨</span>
            </label>
          ) : (
            <p className="text-sm font-medium text-gray-900">{form.baemin_apply ? '✓ 접수됨' : '미접수'}</p>
          )}
        </div>
      </div>

      {/* 진행 상황 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1">진행 상황</p>
        {editing ? (
          <textarea value={form.progress_note} onChange={e => set('progress_note', e.target.value)}
            rows={2} className={INPUT + ' resize-none'} placeholder="현재 진행 상황" />
        ) : (
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{form.progress_note || '-'}</p>
        )}
      </div>

      {/* 비고 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1">비고</p>
        {editing ? (
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)}
            rows={2} className={INPUT + ' resize-none'} />
        ) : (
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{form.memo || '-'}</p>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900'
