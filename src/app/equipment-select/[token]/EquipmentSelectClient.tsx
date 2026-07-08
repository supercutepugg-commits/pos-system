'use client'

import { useState } from 'react'

const EQUIPMENT_OPTIONS = ['포스기', '테블릿', '핸드폰']

interface Row {
  id: string
  business_name?: string | null
  owner_name?: string | null
  equipment_select_token: string
  selected_equipment?: string[] | null
  equipment_selected_at?: string | null
}

export default function EquipmentSelectClient({ row }: { row: Row }) {
  const [selected, setSelected] = useState<string[]>(row.selected_equipment ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(!!row.equipment_selected_at)

  function toggle(option: string) {
    setSelected(prev => prev.includes(option) ? prev.filter(v => v !== option) : [...prev, option])
  }

  async function submit() {
    if (!selected.length) {
      alert('사용하실 장비를 하나 이상 선택해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/franchise/equipment-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: row.equipment_select_token, equipment: selected }),
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
          <p className="text-slate-500 text-sm">담당자가 확인 후 안내드리겠습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full p-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">장비 선택</h1>
          <p className="text-sm text-slate-500 mt-1">
            {(row.owner_name || row.business_name) ? `${row.owner_name || row.business_name}님, ` : ''}
            토스프론트를 연결하여 사용하실 장비를 선택해주세요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {EQUIPMENT_OPTIONS.map(option => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >{submitting ? '전송 중...' : '제출'}</button>
      </div>
    </div>
  )
}
