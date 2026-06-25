'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Copy, ExternalLink, Trash2, FileText, PenLine } from 'lucide-react'
import type { Profile } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: '서명 대기',
  signed: '서명 완료',
  expired: '만료',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  signed: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface Contract {
  id: string
  title: string
  pdf_url: string
  signed_pdf_url?: string
  status: string
  signer_name: string
  signer_email?: string
  signer_phone?: string
  sign_token: string
  token_expires_at: string
  created_at: string
  creator?: { name: string } | null
}

interface Props {
  profile: Profile
  initialContracts: Contract[]
}

export default function ContractsClient({ profile, initialContracts }: Props) {
  const canEdit = profile.role === 'cs' || profile.role === 'admin'
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    signerName: '',
    signerEmail: '',
    signerPhone: '',
  })
  const supabase = createClient()

  async function fetchContracts() {
    const { data } = await supabase
      .from('contracts')
      .select('*, creator:profiles!contracts_created_by_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(300)
    setContracts((data as any) ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pdfFile) { alert('PDF 파일을 선택해주세요.'); return }
    setSubmitting(true)
    setUploading(true)

    const fd = new FormData()
    fd.append('file', pdfFile)
    fd.append('title', form.title)
    fd.append('signerName', form.signerName)
    fd.append('signerEmail', form.signerEmail)
    fd.append('signerPhone', form.signerPhone)
    fd.append('createdBy', profile.id)

    const res = await fetch('/api/contracts/create', { method: 'POST', body: fd })
    const json = await res.json()

    setUploading(false)
    setSubmitting(false)
    if (!res.ok || json.error) { alert(json.error ?? '등록 실패'); return }

    const inserted = { sign_token: json.sign_token }

    // 서명 요청 알림톡 발송
    if (form.signerPhone && inserted?.sign_token) {
      fetch('/api/contracts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sign_request',
          signerPhone: form.signerPhone,
          signerName: form.signerName,
          contractTitle: form.title,
          signToken: inserted.sign_token,
        }),
      }).then(async res => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          console.error('서명 요청 알림톡 발송 실패:', json.error)
          alert('계약서는 등록되었지만 서명 요청 알림톡 발송에 실패했습니다. 고객에게 직접 링크를 전달해주세요.')
        }
      }).catch(err => {
        console.error('서명 요청 알림톡 발송 실패:', err)
        alert('계약서는 등록되었지만 서명 요청 알림톡 발송에 실패했습니다. 고객에게 직접 링크를 전달해주세요.')
      })
    }

    setForm({ title: '', signerName: '', signerEmail: '', signerPhone: '' })
    setPdfFile(null)
    setShowForm(false)
    fetchContracts()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const contract = contracts.find(c => c.id === id)
    await supabase.from('contracts').delete().eq('id', id)
    // Storage 파일도 삭제
    if (contract?.pdf_url) {
      const path = contract.pdf_url.split('/contracts/')[1]
      if (path) await supabase.storage.from('contracts').remove([path])
    }
    if (contract?.signed_pdf_url) {
      const path = contract.signed_pdf_url.split('/contracts/')[1]
      if (path) await supabase.storage.from('contracts').remove([path])
    }
    setContracts(prev => prev.filter(c => c.id !== id))
  }

  function copySignLink(token: string) {
    const url = `${window.location.origin}/sign/${token}`
    navigator.clipboard.writeText(url)
    alert('서명 링크가 복사됐습니다.')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">계약서 / 서명</h1>
          <p className="text-slate-500 text-sm mt-1">총 {contracts.length}건</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 font-semibold">
            <Plus size={16} />새 계약서
          </button>
        )}
      </div>

      {/* 등록 폼 */}
      {canEdit && showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">계약서 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">계약서 제목 *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={INPUT} placeholder="예: 포스기 설치 계약서" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">서명자 성함 *</label>
                <input required value={form.signerName} onChange={e => setForm(f => ({ ...f, signerName: e.target.value }))}
                  className={INPUT} placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">서명자 연락처</label>
                <input value={form.signerPhone} onChange={e => setForm(f => ({ ...f, signerPhone: e.target.value }))}
                  className={INPUT} placeholder="01012345678" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">서명자 이메일</label>
                <input type="email" value={form.signerEmail} onChange={e => setForm(f => ({ ...f, signerEmail: e.target.value }))}
                  className={INPUT} placeholder="example@email.com" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">PDF 파일 *</label>
                <input type="file" accept="application/pdf" required
                  onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-600 file:text-xs file:font-medium" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600">취소</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {uploading ? 'PDF 업로드 중...' : submitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {contracts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">계약서가 없습니다</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {contracts.map(c => (
              <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{c.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{c.signer_name}</span>
                    {c.signer_phone && <span>{c.signer_phone}</span>}
                    <span>{format(new Date(c.created_at), 'M/d', { locale: ko })}</span>
                    <span>만료 {format(new Date(c.token_expires_at), 'M/d', { locale: ko })}</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  {canEdit && (
                    <a href={`/contracts/${c.id}`}
                      className="flex items-center gap-1 text-xs text-purple-600 border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-50">
                      <PenLine size={12} />위치 지정
                    </a>
                  )}
                  <button onClick={() => copySignLink(c.sign_token)}
                    className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50">
                    <Copy size={12} />서명 링크
                  </button>
                  <a href={c.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50">
                    <ExternalLink size={12} />PDF
                  </a>
                  {c.signed_pdf_url && (
                    <a href={c.signed_pdf_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-green-600 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-50">
                      <ExternalLink size={12} />서명본
                    </a>
                  )}
                  {profile.role === 'admin' && (
                    <button onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-400 border border-red-100 px-2.5 py-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
