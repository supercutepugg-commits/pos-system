'use client'

import { useRef, useState, useEffect } from 'react'
import { DndContext, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'

interface SignatureItem {
  id: string
  type: 'signature' | 'stamp'
  dataUrl: string
  x: number; y: number; width: number; height: number
  pageNumber: number
}

interface Contract {
  id: string
  title: string
  pdf_url: string
  signer_name: string
  status: string
  sign_token: string
  token_expires_at: string
}

interface Props {
  contract: Contract
}

function DraggableItem({ item, onResize, onRemove }: { item: SignatureItem; onResize: (id: string, w: number, h: number) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.id })
  const style = {
    position: 'absolute' as const,
    left: item.x + (transform?.x ?? 0),
    top: item.y + (transform?.y ?? 0),
    width: item.width,
    height: item.height,
    userSelect: 'none' as const,
    touchAction: 'none' as const,
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startW = item.width, startH = item.height
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

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    setHasStroke(true)
  }

  function endDraw() { setDrawing(false) }

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <p className="font-bold text-gray-900">서명하기</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <canvas ref={canvasRef} width={460} height={200}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 touch-none"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
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
  const [items, setItems] = useState<SignatureItem[]>([])
  const [showPad, setShowPad] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(contract.status === 'signed')
  const stampRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  function handleSignatureComplete(dataUrl: string) {
    setShowPad(false)
    setItems(prev => [...prev, {
      id: `sig-${Date.now()}`, type: 'signature', dataUrl,
      x: 50, y: 50, width: 160, height: 80, pageNumber: 1,
    }])
  }

  function handleStampFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setItems(prev => [...prev, {
        id: `stamp-${Date.now()}`, type: 'stamp', dataUrl: ev.target!.result as string,
        x: 80, y: 80, width: 100, height: 100, pageNumber: 1,
      }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleDragEnd(event: any) {
    const { active, delta } = event
    setItems(prev => prev.map(item => item.id === active.id ? { ...item, x: item.x + delta.x, y: item.y + delta.y } : item))
  }

  function handleResize(id: string, w: number, h: number) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, width: w, height: h } : item))
  }

  async function handleSubmit() {
    if (items.length === 0) { alert('서명 또는 도장을 추가해주세요.'); return }
    if (!confirm('서명을 완료하시겠습니까? 이후 수정이 불가합니다.')) return
    setSubmitting(true)

    // 서명 이미지를 Supabase Storage에 업로드
    const signedItems = await Promise.all(items.map(async (item) => {
      const blob = await (await fetch(item.dataUrl)).blob()
      const fileName = `signatures/${contract.id}/${item.id}.png`
      await supabase.storage.from('contracts').upload(fileName, blob, { contentType: 'image/png', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(fileName)
      return { ...item, dataUrl: publicUrl }
    }))

    await supabase.from('contracts').update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_zones: signedItems,
    }).eq('id', contract.id)

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
      {/* 사이드 패널 */}
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

          {items.length > 0 && (
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
          <button onClick={handleSubmit} disabled={submitting || items.length === 0}
            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition">
            {submitting ? '처리 중...' : '서명 완료'}
          </button>
          {items.length === 0 && <p className="text-xs text-gray-400 text-center mt-2">서명을 먼저 추가해주세요</p>}
        </div>
      </div>

      {/* PDF + 서명 오버레이 */}
      <div className="flex-1 overflow-auto bg-gray-100 relative p-4">
        <div className="relative inline-block bg-white shadow-lg">
          <iframe src={contract.pdf_url} className="w-full min-h-screen" style={{ minWidth: 600, height: '90vh' }} />
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="absolute inset-0 pointer-events-none">
              <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', height: '100%' }}>
                {items.map(item => (
                  <DraggableItem key={item.id} item={item} onResize={handleResize}
                    onRemove={id => setItems(prev => prev.filter(i => i.id !== id))} />
                ))}
              </div>
            </div>
          </DndContext>
        </div>
      </div>

      {showPad && <SignaturePadModal onComplete={handleSignatureComplete} onClose={() => setShowPad(false)} />}
    </div>
  )
}
