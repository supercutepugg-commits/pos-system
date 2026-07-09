'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { NotificationHistory } from '@/components/ui/NotificationHistory'
import { useToast } from '@/components/ui/Toast'

const MIN_ZONE_WIDTH = 20
const MIN_ZONE_HEIGHT = 10

interface Zone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

interface Contract {
  id: string
  title: string
  pdf_url: string
  signer_name: string
  signer_phone?: string
  status: string
  sign_token: string
  signature_zones: Zone[]
}

interface Props {
  contract: Contract
}

export default function ZoneEditor({ contract }: Props) {
  const [zones, setZones] = useState<Zone[]>(contract.signature_zones ?? [])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [label, setLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [pendingZone, setPendingZone] = useState<Omit<Zone, 'id' | 'label'> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (JSON.stringify(zones) !== JSON.stringify(contract.signature_zones ?? [])) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [zones, contract.signature_zones])

  function getRelativePos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (showLabelInput) return
    const pos = getRelativePos(e)
    setStartPos(pos)
    setDrawing(true)
    setCurrentRect(null)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    const pos = getRelativePos(e)
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    })
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!drawing) return
    setDrawing(false)
    if (!currentRect || currentRect.width < MIN_ZONE_WIDTH || currentRect.height < MIN_ZONE_HEIGHT) {
      if (currentRect) toast.warning(`서명 위치가 너무 작아서 무시됐습니다 (최소 ${MIN_ZONE_WIDTH}x${MIN_ZONE_HEIGHT}px).`)
      setCurrentRect(null)
      return
    }
    setPendingZone(currentRect)
    setShowLabelInput(true)
  }

  function confirmZone() {
    if (!pendingZone) return
    setZones(prev => [...prev, {
      id: `zone-${Date.now()}`,
      label: label || `서명 ${zones.length + 1}`,
      ...pendingZone,
    }])
    setLabel('')
    setShowLabelInput(false)
    setPendingZone(null)
    setCurrentRect(null)
  }

  function cancelZone() {
    setShowLabelInput(false)
    setPendingZone(null)
    setCurrentRect(null)
    setLabel('')
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('contracts').update({ signature_zones: zones }).eq('id', contract.id)
    setSaving(false)
    if (error) { toast.error('저장 실패: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSend() {
    if (zones.length === 0) {
      alert('서명 위치를 1개 이상 지정해야 발송할 수 있습니다.')
      return
    }
    if (!contract.signer_phone) {
      alert('서명자 연락처가 없어 발송할 수 없습니다.')
      return
    }
    setSending(true)
    await supabase.from('contracts').update({ signature_zones: zones }).eq('id', contract.id)
    try {
      const res = await fetch('/api/contracts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sign_request',
          signerPhone: contract.signer_phone,
          signerName: contract.signer_name,
          contractTitle: contract.title,
          signToken: contract.sign_token,
          contractId: contract.id,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert('서명 요청 알림톡 발송에 실패했습니다: ' + (json.error ?? '알 수 없는 오류'))
      } else {
        alert('서명 요청 알림톡을 발송했습니다.')
      }
    } catch (err) {
      alert('서명 요청 알림톡 발송에 실패했습니다.')
      console.error(err)
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Link href="/contracts" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <p className="font-bold text-slate-900 text-sm">{contract.title}</p>
          <p className="text-xs text-slate-400">{contract.signer_name} · PDF에서 드래그해서 서명 위치를 지정하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">서명칸 {zones.length}개</span>
          <button onClick={() => setZones([])}
            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
            <Trash2 size={13} />전체 삭제
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save size={14} />{saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={handleSend} disabled={sending || zones.length === 0}
            title={zones.length === 0 ? '서명 위치를 먼저 지정해야 발송할 수 있습니다' : undefined}
            className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
            <Send size={14} />{sending ? '발송 중...' : '서명 요청 발송'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {}
        <div className="w-56 bg-white border-r border-slate-200 p-4 flex-shrink-0 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 mb-3">지정된 서명 위치</p>
          {zones.length === 0 ? (
            <p className="text-xs text-slate-400">PDF 위에서 드래그해서 서명 위치를 추가하세요</p>
          ) : (
            <ul className="space-y-2">
              {zones.map((z, i) => (
                <li key={z.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700 font-medium">{z.label}</span>
                  <button onClick={() => setZones(prev => prev.filter(zone => zone.id !== z.id))}
                    className="text-slate-300 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <NotificationHistory
              entityType="contract"
              entityId={contract.id}
              labelMap={{ sign_request: '서명 요청', sign_complete: '서명 완료 안내' }}
            />
          </div>
        </div>

        {}
        <div className="flex-1 overflow-auto p-4">
          <div className="relative inline-block shadow-lg bg-white">
            <iframe src={contract.pdf_url} className="block" style={{ width: 800, height: '90vh', minHeight: 600 }} />

            {}
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ cursor: drawing ? 'crosshair' : 'crosshair' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {}
              {zones.map(z => (
                <div key={z.id} style={{ position: 'absolute', left: z.x, top: z.y, width: z.width, height: z.height }}
                  className="border-2 border-blue-500 bg-blue-50/40 flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-700 bg-white px-1 rounded shadow-sm">{z.label}</span>
                </div>
              ))}

              {}
              {currentRect && (
                <div style={{ position: 'absolute', left: currentRect.x, top: currentRect.y, width: currentRect.width, height: currentRect.height }}
                  className="border-2 border-dashed border-blue-400 bg-blue-100/30 pointer-events-none" />
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      {showLabelInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-80">
            <p className="font-bold text-slate-900 mb-3">서명 위치 이름</p>
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmZone(); if (e.key === 'Escape') cancelZone() }}
              placeholder={`서명 ${zones.length + 1}`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={cancelZone} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600">취소</button>
              <button onClick={confirmZone} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
