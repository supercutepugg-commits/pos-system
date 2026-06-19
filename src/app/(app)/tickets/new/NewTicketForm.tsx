'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Props {
  merchants: { id: string; business_name: string; phone: string }[]
  salesId: string
}

export default function NewTicketForm({ merchants, salesId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showNewMerchant, setShowNewMerchant] = useState(false)
  const [form, setForm] = useState({
    merchant_id: '',
    title: '',
    type: 'install',
    priority: 'normal',
    memo: '',
  })
  const [merchantForm, setMerchantForm] = useState({
    business_name: '',
    owner_name: '',
    business_number: '',
    phone: '',
    address: '',
    address_detail: '',
    pos_model: '',
    service_type: '',
  })

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    let merchantId = form.merchant_id

    // 신규 가맹점 등록
    if (showNewMerchant) {
      const { data, error } = await supabase.from('merchants').insert({
        ...merchantForm,
        sales_id: salesId,
      }).select('id').single()

      if (error || !data) {
        alert('가맹점 등록 실패: ' + error?.message)
        setLoading(false)
        return
      }
      merchantId = data.id
    }

    if (!merchantId) {
      alert('가맹점을 선택하거나 신규 가맹점을 등록해주세요.')
      setLoading(false)
      return
    }

    const { data: ticket, error } = await supabase.from('tickets').insert({
      merchant_id: merchantId,
      title: form.title,
      type: form.type,
      priority: form.priority,
      memo: form.memo,
      sales_id: salesId,
      status: 'sales',
    }).select('id').single()

    if (error || !ticket) {
      alert('등록 실패: ' + error?.message)
      setLoading(false)
      return
    }

    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      user_id: salesId,
      to_status: 'sales',
      message: '신규 작업 등록',
    })

    router.push(`/tickets/${ticket.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 가맹점 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">가맹점</h2>

        <div className="flex gap-2">
          <button type="button" onClick={() => setShowNewMerchant(false)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${!showNewMerchant ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600'}`}>
            기존 가맹점
          </button>
          <button type="button" onClick={() => setShowNewMerchant(true)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${showNewMerchant ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600'}`}>
            신규 가맹점
          </button>
        </div>

        {!showNewMerchant ? (
          <select
            value={form.merchant_id}
            onChange={e => set('merchant_id', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">가맹점 선택</option>
            {merchants.map(m => (
              <option key={m.id} value={m.id}>{m.business_name} ({m.phone})</option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['business_name', '상호명 *', true],
              ['owner_name', '대표자명 *', true],
              ['phone', '연락처 *', true],
              ['business_number', '사업자번호', false],
              ['pos_model', '포스 기종', false],
              ['service_type', '서비스 종류', false],
            ].map(([key, label, required]) => (
              <div key={key as string} className={key === 'phone' || key === 'business_number' ? '' : ''}>
                <label className="block text-xs text-gray-500 mb-1">{label as string}</label>
                <input
                  type="text"
                  required={required as boolean}
                  value={merchantForm[key as keyof typeof merchantForm]}
                  onChange={e => setMerchantForm(f => ({ ...f, [key as string]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">주소 *</label>
              <input required value={merchantForm.address} onChange={e => setMerchantForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" placeholder="기본 주소" />
              <input value={merchantForm.address_detail} onChange={e => setMerchantForm(f => ({ ...f, address_detail: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="상세 주소" />
            </div>
          </div>
        )}
      </div>

      {/* 작업 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">작업 정보</h2>

        <div>
          <label className="block text-xs text-gray-500 mb-1">작업 제목 *</label>
          <input required value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="예: 신규 포스 설치"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">작업 유형</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="install">신규 설치</option>
              <option value="as">A/S</option>
              <option value="consult">상담</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">우선순위</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">낮음</option>
              <option value="normal">보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">메모</label>
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/tickets" className="flex-1 text-center py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
          취소
        </Link>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? '등록 중...' : '작업 등록'}
        </button>
      </div>
    </form>
  )
}
