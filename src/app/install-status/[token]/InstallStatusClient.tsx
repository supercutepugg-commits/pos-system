'use client'

import { useState } from 'react'

interface Install {
  id: string
  customer_name: string
  status: string
  status_token: string
  requested_date?: string | null
  requested_time_slot?: string | null
  schedule_request_note?: string | null
  schedule_request_at?: string | null
}

export default function InstallStatusClient({ install }: { install: Install }) {
  const [wantsDateChange, setWantsDateChange] = useState(false)
  const [requestedDate, setRequestedDate] = useState(install.requested_date ?? '')
  const [customTime, setCustomTime] = useState(install.requested_time_slot ?? '')
  const [note, setNote] = useState(install.schedule_request_note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(!!install.schedule_request_at)

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/installs/schedule-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: install.status_token,
          requestedDate: wantsDateChange ? requestedDate || null : null,
          timeSlot: customTime.trim() || null,
          note: note || null,
        }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      alert('전송에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full">
          <p className="text-2xl font-bold text-green-600 mb-2">전달되었습니다</p>
          <p className="text-slate-500 text-sm">담당자가 확인 후 일정을 조율해드리겠습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full p-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">설치 일정 확인</h1>
          <p className="text-sm text-slate-500 mt-1">{install.customer_name}님, 설치 전 일정을 확인해주세요.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={wantsDateChange} onChange={e => setWantsDateChange(e.target.checked)} />
            날짜 변경이 필요해요
          </label>
          {wantsDateChange && (
            <input
              type="date"
              value={requestedDate}
              onChange={e => setRequestedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">희망하시는 시간대</label>
          <input
            type="text"
            value={customTime}
            onChange={e => setCustomTime(e.target.value)}
            placeholder="예: 오후 2시 30분"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">전달할 말씀 (선택)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="예: 오후 3시 이후에만 가능해요"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >{submitting ? '전송 중...' : '담당자에게 전달하기'}</button>
      </div>
    </div>
  )
}
