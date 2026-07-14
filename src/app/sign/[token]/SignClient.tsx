'use client'

import { useRef, useState, useEffect } from 'react'
import { DndContext, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { usePdfPageCanvas } from '@/hooks/usePdfPageCanvas'
import { pixelToRatio, ratioToPixel, isRatioRect, type RatioRect, type PixelRect } from '@/lib/pdf/zoneCoords'

interface SignatureItem extends RatioRect {
  id: string
  type: 'signature' | 'stamp'
  dataUrl: string
  pageNumber: number
}

interface Zone extends RatioRect {
  id: string
  label: string
  required: boolean
}

interface Contract {
  id: string
  title: string
  pdf_url: string
  signer_name: string
  status: string
  sign_token: string
  token_expires_at: string
  signature_zones?: unknown[]
  signer_phone?: string
}

interface Props {
  contract: Contract
}

function DraggableItem({ item, px, onResize, onRemove }: { item: SignatureItem; px: PixelRect; onResize: (id: string, w: number, h: number) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.id })
  const style = {
    position: 'absolute' as const,
    left: px.x + (transform?.x ?? 0),
    top: px.y + (transform?.y ?? 0),
    width: px.width,
    height: px.height,
    userSelect: 'none' as const,
    touchAction: 'none' as const,
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startW = px.width, startH = px.height
    function onMove(ev: PointerEvent) { onResize(item.id, Math.max(40, startW + ev.clientX - startX), Math.max(20, startH + ev.clientY - startY)) }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-move">
      <img src={item.dataUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      <button onPointerDown={e => { e.stopPropagation(); onRemove(item.id) }}
        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow z-10"
        style={{ pointerEvents: 'auto', touchAction: 'none' }}>×</button>
      <div onPointerDown={handleResizePointerDown}
        className="absolute bottom-0 right-0 w-4 h-4 bg-gray-900 cursor-se-resize rounded-sm z-10"
        style={{ pointerEvents: 'auto', touchAction: 'none' }} />
    </div>
  )
}

function SignaturePadModal({ onComplete, onClose }: { onComplete: (dataUrl: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current!
    canvas.setPointerCapture(e.pointerId)
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    setHasStroke(true)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.releasePointerCapture(e.pointerId)
    setDrawing(false)
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }

  function complete() {
    if (!hasStroke) return
    onComplete(canvasRef.current!.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <p className="font-bold text-gray-900">서명하기</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <canvas ref={canvasRef} width={460} height={200}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 touch-none"
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
          <p className="text-xs text-gray-400 text-center mt-2">위 공간에 서명을 그려주세요</p>
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={clear} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">지우기</button>
          <button onClick={complete} disabled={!hasStroke}
            className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40">완료</button>
        </div>
      </div>
    </div>
  )
}

export default function SignClient({ contract }: Props) {
  const zones: Zone[] = ((contract.signature_zones ?? []).filter(isRatioRect))
    .map(z => ({ ...z, required: (z as Partial<Zone>).required ?? true })) as Zone[]
  const hasZones = zones.length > 0
  const requiredZones = zones.filter(z => z.required)

  const [signedZones, setSignedZones] = useState<Record<string, string>>({})
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null)

  const [items, setItems] = useState<SignatureItem[]>([])
  const [showPad, setShowPad] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(contract.status === 'signed')
  const stampRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { canvasRef, renderedWidth, renderedHeight, error: pdfError } = usePdfPageCanvas(contract.pdf_url, containerRef)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  function handleSignatureComplete(dataUrl: string) {
    setShowPad(false)
    if (activeZoneId) {
      setSignedZones(prev => ({ ...prev, [activeZoneId]: dataUrl }))
      setActiveZoneId(null)
      return
    }
    const w = renderedWidth ?? 600
    const h = renderedHeight ?? 800
    setItems(prev => [...prev, {
      id: `sig-${Date.now()}`, type: 'signature', dataUrl,
      xRatio: 50 / w, yRatio: 50 / h, widthRatio: 160 / w, heightRatio: 80 / h, pageNumber: 1,
    }])
  }

  function handleStampFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const w = renderedWidth ?? 600
      const h = renderedHeight ?? 800
      setItems(prev => [...prev, {
        id: `stamp-${Date.now()}`, type: 'stamp', dataUrl: ev.target!.result as string,
        xRatio: 80 / w, yRatio: 80 / h, widthRatio: 100 / w, heightRatio: 100 / h, pageNumber: 1,
      }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleDragEnd(event: any) {
    const { active, delta } = event
    if (!renderedWidth || !renderedHeight) return
    setItems(prev => prev.map(item => {
      if (item.id !== active.id) return item
      const px = ratioToPixel(item, renderedWidth, renderedHeight)
      return {
        ...item,
        ...pixelToRatio({ x: px.x + delta.x, y: px.y + delta.y, width: px.width, height: px.height }, renderedWidth, renderedHeight),
      }
    }))
  }

  function handleResize(id: string, w: number, h: number) {
    if (!renderedWidth || !renderedHeight) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, widthRatio: w / renderedWidth, heightRatio: h / renderedHeight } : item))
  }

  async function handleSubmit() {
    if (hasZones) {
      const missingRequired = requiredZones.filter(z => !signedZones[z.id])
      if (missingRequired.length > 0) {
        alert(`아직 서명하지 않은 칸이 있습니다:\n${missingRequired.map(z => z.label).join(', ')}`)
        return
      }
    } else if (items.length === 0) {
      alert('서명 또는 도장을 추가해주세요.')
      return
    }

    const missingOptional = zones.filter(z => !z.required && !signedZones[z.id])
    const confirmMessage = missingOptional.length > 0
      ? `다음 선택 항목에는 서명하지 않았습니다: ${missingOptional.map(z => z.label).join(', ')}.\n이대로 제출하시겠습니까? 이후 수정이 불가합니다.`
      : '서명을 완료하시겠습니까? 이후 수정이 불가합니다.'
    if (!confirm(confirmMessage)) return
    setSubmitting(true)

    const submitItems: SignatureItem[] = hasZones
      ? zones.filter(z => signedZones[z.id]).map(z => ({
          id: z.id, type: 'signature', dataUrl: signedZones[z.id],
          xRatio: z.xRatio, yRatio: z.yRatio, widthRatio: z.widthRatio, heightRatio: z.heightRatio, pageNumber: 1,
        }))
      : items

    const signRes = await fetch('/api/contracts/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: contract.sign_token, items: submitItems }),
    })

    if (!signRes.ok) {
      const json = await signRes.json().catch(() => ({}))
      alert('서명 저장 실패: ' + (json.error ?? '알 수 없는 오류'))
      setSubmitting(false)
      return
    }

    fetch('/api/contracts/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sign_complete',
        signerPhone: contract.signer_phone ?? '',
        signerName: contract.signer_name,
        contractTitle: contract.title,
        contractId: contract.id,
      }),
    }).then(async res => {
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error('서명 완료 알림톡 발송 실패:', json.error)
      }
    }).catch(err => console.error('서명 완료 알림톡 발송 실패:', err))

    setSubmitting(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">서명이 완료되었습니다</h1>
          <p className="text-sm text-gray-500">감사합니다.</p>
        </div>
      </div>
    )
  }

  const isExpired = new Date(contract.token_expires_at) < new Date()
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">링크가 만료되었습니다</h1>
          <p className="text-sm text-gray-500">담당자에게 재발송을 요청해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {}
      <div className="w-full lg:w-72 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
        <div className="h-14 flex items-center gap-2.5 px-6 border-b border-gray-100">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <span className="text-sm font-semibold text-gray-900">POS 전산</span>
        </div>
        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
          <div>
            <p className="text-xs text-gray-400 mb-1">계약서</p>
            <h1 className="text-base font-semibold text-gray-900">{contract.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{contract.signer_name}님께 서명을 요청드립니다</p>
          </div>

          {hasZones ? (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">서명 위치 ({Object.keys(signedZones).length}/{zones.length})</p>
              <ul className="space-y-1.5">
                {zones.map((zone, i) => (
                  <li key={zone.id} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 border ${signedZones[zone.id] ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-100 text-gray-500'}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="truncate">{zone.label}</span>
                      <span className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded ${zone.required ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                        {zone.required ? '필수' : '선택'}
                      </span>
                    </span>
                    {signedZones[zone.id] ? <span className="flex-shrink-0">✓ 완료</span> : <span className="text-gray-300 flex-shrink-0">미서명</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-3">PDF의 점선 박스를 클릭해서 서명하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">서명 / 도장</p>
              <button onClick={() => setShowPad(true)}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition">
                서명 그리기
              </button>
              <button onClick={() => stampRef.current?.click()}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-white transition">
                도장 이미지 업로드
              </button>
              <input ref={stampRef} type="file" accept="image/png,image/jpeg" onChange={handleStampFile} className="hidden" />
            </div>
          )}

          {!hasZones && items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">배치된 항목 ({items.length})</p>
              <ul className="space-y-1.5">
                {items.map(item => (
                  <li key={item.id} className="flex items-center justify-between text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <span>{item.type === 'signature' ? '서명' : '도장'}</span>
                    <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="text-gray-400 hover:text-red-500">삭제</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t border-gray-100">
          <button onClick={handleSubmit} disabled={submitting || (hasZones ? requiredZones.some(z => !signedZones[z.id]) : items.length === 0)}
            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition">
            {submitting ? '처리 중...' : '서명 완료'}
          </button>
          {hasZones && requiredZones.some(z => !signedZones[z.id]) && (
            <p className="text-xs text-gray-400 text-center mt-2">필수 서명 칸을 모두 완료해주세요</p>
          )}
          {!hasZones && items.length === 0 && <p className="text-xs text-gray-400 text-center mt-2">서명을 먼저 추가해주세요</p>}
        </div>
      </div>

      {}
      <div className="flex-1 overflow-auto bg-gray-100 relative p-4">
        <div ref={containerRef} className="relative bg-white shadow-lg mx-auto" style={{ maxWidth: 900, minWidth: 320 }}>
          <canvas ref={canvasRef} className="block" />
          {pdfError && (
            <p className="p-4 text-sm text-red-500">PDF를 불러오지 못했습니다: {pdfError}</p>
          )}

          {}
          {hasZones && renderedWidth && renderedHeight && (
            <div className="absolute inset-0 pointer-events-none">
              {zones.map((zone, i) => {
                const px = ratioToPixel(zone, renderedWidth, renderedHeight)
                return (
                  <div key={zone.id}
                    style={{ position: 'absolute', left: px.x, top: px.y, width: px.width, height: px.height, pointerEvents: 'auto' }}
                    className={`border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${signedZones[zone.id] ? 'border-green-400 bg-green-50/60' : 'border-blue-400 bg-blue-50/40 hover:bg-blue-100/60'}`}
                    onClick={() => { if (!signedZones[zone.id]) { setActiveZoneId(zone.id); setShowPad(true) } }}>
                    {signedZones[zone.id] ? (
                      <img src={signedZones[zone.id]} alt="서명" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm select-none">{i + 1}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {}
          {!hasZones && renderedWidth && renderedHeight && (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="absolute inset-0 pointer-events-none">
                <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', height: '100%' }}>
                  {items.map(item => (
                    <DraggableItem key={item.id} item={item} px={ratioToPixel(item, renderedWidth, renderedHeight)} onResize={handleResize}
                      onRemove={id => setItems(prev => prev.filter(i => i.id !== id))} />
                  ))}
                </div>
              </div>
            </DndContext>
          )}
        </div>
      </div>

      {showPad && <SignaturePadModal onComplete={handleSignatureComplete} onClose={() => setShowPad(false)} />}
    </div>
  )
}
