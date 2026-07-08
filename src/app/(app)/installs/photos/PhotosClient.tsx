'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Profile } from '@/types'

interface Install {
  id: string
  customer_name: string
  delivery_type?: string
  completion_photo_urls: string[]
  created_at: string
  assignee?: { name: string } | null
}

interface Props {
  profile: Profile
  installs: Install[]
}

const TABS = [
  ['all', '전체'],
  ['install', '설치'],
  ['as', 'AS'],
] as const

export default function PhotosClient({ installs }: Props) {
  const [tab, setTab] = useState<'all' | 'install' | 'as'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return installs.filter(i => {
      if (tab !== 'all' && (i.delivery_type ?? 'install') !== tab) return false
      if (q && !i.customer_name?.toLowerCase().includes(q)) return false
      return true
    })
  }, [installs, tab, search])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">완료사진</h1>
        <p className="text-slate-500 text-sm mt-1">설치/AS 완료 시 등록된 사진 모음 (총 {installs.length}건)</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${tab === key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="상호명 검색"
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">완료사진이 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(inst => (
            <div key={inst.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-slate-900 truncate">{inst.customer_name}</span>
                <span className={`text-xs font-medium rounded-lg border px-2 py-0.5 shrink-0 ${(inst.delivery_type ?? 'install') === 'as' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                  {(inst.delivery_type ?? 'install') === 'as' ? 'AS' : '설치'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {inst.assignee?.name ?? '미배정'} · {format(new Date(inst.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {inst.completion_photo_urls.map((url, idx) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" download={`${inst.customer_name} ${idx + 1}.jpg`}>
                    <img src={url} alt={inst.customer_name} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
