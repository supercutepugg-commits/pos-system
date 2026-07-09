'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Props {
  salesId: string
  role: string
}

const RECEPTION_CHANNELS = ['전화', '카카오톡', '문자', '방문', '온라인', '기타']
const DOCUMENT_STATUSES = ['미접수', '일부접수', '완료']
const VAN_COMPANIES = ['KIS', 'NICE', 'KCP', 'KSNET', '한국정보통신', '스마트로', 'JTNET', '기타']
const SIMPLE_PAYMENTS = ['카카오페이', '네이버페이', '페이코', '삼성페이', 'SSG페이', 'L페이', '기타', '없음']

export default function NewTicketForm({ salesId, role }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    merchant_id: '',
    title: '',
    type: 'install',
    priority: 'normal',
    memo: '',
    business_type: '개인',
    reception_channel: '',
    progress_note: '',
    document_status: '미접수',
    internet: '',
    product: '',
    card_apply_date: '',
    van_company: '',
    baemin_apply: false,
    simple_payment: '',
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

  function set(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { data: merchantData, error: merchantError } = await supabase.from('merchants').insert({
      ...merchantForm,
      sales_id: salesId,
    }).select('id').single()

    if (merchantError || !merchantData) {
      alert('가맹점 등록 실패: ' + merchantError?.message)
      setLoading(false)
      return
    }

    const merchantId = merchantData.id

    const { data: ticket, error } = await supabase.from('tickets').insert({
      merchant_id: merchantId,
      title: form.title,
      type: form.type,
      priority: form.priority,
      memo: form.memo,
      sales_id: role === 'sales' ? salesId : null,
      cs_id: role === 'cs' ? salesId : null,
      status: role === 'cs' ? 'cs_pending' : 'sales',
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
    }).select('id').single()

    if (error || !ticket) {
      
      
      await supabase.from('merchants').delete().eq('id', merchantId)
      alert('등록 실패: ' + error?.message)
      setLoading(false)
      return
    }

    const { error: logError } = await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      user_id: salesId,
      to_status: role === 'cs' ? 'cs_pending' : 'sales',
      message: '신규 작업 등록',
    })
    if (logError) {
      alert('작업은 등록되었지만 이력 기록에 실패했습니다: ' + logError.message)
    }

    router.push(`/tickets/${ticket.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {}
      <Section title="가맹점 정보">
        <div className="grid grid-cols-2 gap-3">
          {([
            ['business_name', '상호명 *', true],
            ['owner_name', '대표자명 *', true],
            ['phone', '연락처 *', true],
            ['business_number', '사업자번호', false],
            ['pos_model', '포스 기종', false],
            ['service_type', '서비스 종류', false],
          ] as [string, string, boolean][]).map(([key, label, required]) => (
            <div key={key}>
              <Label>{label}</Label>
              <input type="text" required={required}
                value={merchantForm[key as keyof typeof merchantForm]}
                onChange={e => setMerchantForm(f => ({ ...f, [key]: e.target.value }))}
                className={INPUT} />
            </div>
          ))}
          <div className="col-span-2">
            <Label>주소</Label>
            <input value={merchantForm.address}
              onChange={e => setMerchantForm(f => ({ ...f, address: e.target.value }))}
              className={INPUT + ' mb-2'} placeholder="기본 주소" />
            <input value={merchantForm.address_detail}
              onChange={e => setMerchantForm(f => ({ ...f, address_detail: e.target.value }))}
              className={INPUT} placeholder="상세 주소" />
          </div>
        </div>
      </Section>

      {}
      <Section title="기본 정보">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>작업 제목 *</Label>
            <input required value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="예: 신규 포스 설치"
              className={INPUT} />
          </div>

          <div>
            <Label>사업자 구분</Label>
            <select value={form.business_type} onChange={e => set('business_type', e.target.value)} className={INPUT}>
              <option value="개인">개인사업자</option>
              <option value="법인">법인사업자</option>
            </select>
          </div>

          <div>
            <Label>접수 채널</Label>
            <select value={form.reception_channel} onChange={e => set('reception_channel', e.target.value)} className={INPUT}>
              <option value="">선택</option>
              {RECEPTION_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <Label>작업 유형</Label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={INPUT}>
              <option value="install">신규 설치</option>
              <option value="as">A/S</option>
              <option value="consult">상담</option>
              <option value="other">기타</option>
            </select>
          </div>

          <div>
            <Label>우선순위</Label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className={INPUT}>
              <option value="low">낮음</option>
              <option value="normal">보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>
        </div>
      </Section>

      {}
      <Section title="CS 처리 정보">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>서류 접수 상태</Label>
            <select value={form.document_status} onChange={e => set('document_status', e.target.value)} className={INPUT}>
              {DOCUMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <Label>상품</Label>
            <input value={form.product} onChange={e => set('product', e.target.value)} className={INPUT} placeholder="예: 포스 단말기" />
          </div>

          <div>
            <Label>VAN사</Label>
            <select value={form.van_company} onChange={e => set('van_company', e.target.value)} className={INPUT}>
              <option value="">선택</option>
              {VAN_COMPANIES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <Label>인터넷</Label>
            <input value={form.internet} onChange={e => set('internet', e.target.value)} className={INPUT} placeholder="예: KT, SKT" />
          </div>

          <div>
            <Label>카드가맹 접수일</Label>
            <input type="date" value={form.card_apply_date} onChange={e => set('card_apply_date', e.target.value)} className={INPUT} />
          </div>

          <div>
            <Label>간편결제</Label>
            <select value={form.simple_payment} onChange={e => set('simple_payment', e.target.value)} className={INPUT}>
              <option value="">선택</option>
              {SIMPLE_PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="col-span-2 flex items-center gap-3 py-1">
            <input type="checkbox" id="baemin" checked={form.baemin_apply}
              onChange={e => set('baemin_apply', e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer" />
            <label htmlFor="baemin" className="text-sm text-gray-700 cursor-pointer select-none">배민 접수</label>
          </div>
        </div>
      </Section>

      {}
      <Section title="메모 / 비고">
        <div className="space-y-3">
          <div>
            <Label>진행 상황</Label>
            <textarea value={form.progress_note} onChange={e => set('progress_note', e.target.value)} rows={2}
              className={INPUT + ' resize-none'} placeholder="현재 진행 상황을 입력하세요" />
          </div>
          <div>
            <Label>비고</Label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={2}
              className={INPUT + ' resize-none'} />
          </div>
        </div>
      </Section>

      <div className="flex gap-3 pb-6">
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

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-500 mb-1">{children}</label>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

