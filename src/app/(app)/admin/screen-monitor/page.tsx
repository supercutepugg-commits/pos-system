'use client'

import { useEffect, useRef, useState } from 'react'
import { Monitor, RefreshCw, Wifi, WifiOff } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 모니터링할 기기 목록 (추가/수정 가능)
const MACHINES = [
  { id: 'PC-1', label: '사무실 PC-1' },
  { id: 'PC-2', label: '사무실 PC-2' },
  { id: 'PC-3', label: '현장 기사 PC-3' },
]

function ScreenViewer({ machine }: { machine: { id: string; label: string } }) {
  const [src, setSrc] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/screens/${machine.id}.jpg`

  useEffect(() => {
    let alive = true
    async function poll() {
      while (alive) {
        try {
          const url = `${imgUrl}?t=${Date.now()}`
          const res = await fetch(url, { method: 'HEAD' })
          if (res.ok) {
            setSrc(url)
            setOnline(true)
            setLastUpdate(new Date())
          } else {
            setOnline(false)
          }
        } catch {
          setOnline(false)
        }
        await new Promise(r => setTimeout(r, 600))
      }
    }
    poll()
    return () => { alive = false }
  }, [imgUrl])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Monitor size={15} className="text-slate-400" />
          <span className="font-semibold text-sm text-slate-800">{machine.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-slate-400">{lastUpdate.toLocaleTimeString('ko-KR')}</span>
          )}
          {online
            ? <span className="flex items-center gap-1 text-xs text-green-600"><Wifi size={12} />연결됨</span>
            : <span className="flex items-center gap-1 text-xs text-slate-400"><WifiOff size={12} />오프라인</span>
          }
        </div>
      </div>
      <div className="bg-slate-900 aspect-video flex items-center justify-center">
        {src && online ? (
          <img src={src} alt={machine.label} className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-slate-500">
            <Monitor size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">화면 공유 대기 중</p>
            <p className="text-xs opacity-60 mt-1">screen_share.py 실행 필요</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ScreenMonitorPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
          <Monitor size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-lg">화면 모니터링</h1>
          <p className="text-xs text-slate-400">실시간 직원 화면 공유</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
        직원 PC에서 <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">python screen_share.py PC-1</code> 실행 시 화면이 표시됩니다.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {MACHINES.map(m => (
          <ScreenViewer key={m.id} machine={m} />
        ))}
      </div>
    </div>
  )
}
