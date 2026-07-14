'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

let workerConfigured = false
function ensureWorker() {
  if (workerConfigured || typeof window === 'undefined') return
  workerConfigured = true
  import('pdfjs-dist').then(({ GlobalWorkerOptions }) => {
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  })
}

interface Result {
  canvasRef: RefObject<HTMLCanvasElement | null>
  renderedWidth: number | null
  renderedHeight: number | null
  error: string | null
}

// 계약서 서명 zone은 현재 1페이지만 지원한다 (Zone 타입에 pageNumber 필드 없음).
export function usePdfPageCanvas(pdfUrl: string, containerRef: RefObject<HTMLElement | null>, pageNumber = 1): Result {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureWorker()
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    let renderTask: RenderTask | null = null

    async function renderAt(width: number) {
      if (!doc || cancelled || width <= 0) return
      const page = await doc.getPage(pageNumber)
      const unscaled = page.getViewport({ scale: 1 })
      const scale = width / unscaled.width
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(viewport.width * dpr)
      canvas.height = Math.round(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderTask?.cancel()
      renderTask = page.render({ canvasContext: ctx, viewport })
      try {
        await renderTask.promise
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== 'RenderingCancelledException') throw e
        return
      }
      if (!cancelled) setSize({ width: viewport.width, height: viewport.height })
    }

    async function init() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        doc = await pdfjsLib.getDocument(pdfUrl).promise
        if (cancelled) return
        const width = containerRef.current?.clientWidth || 800
        await renderAt(width)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'PDF 렌더링 실패')
      }
    }
    init()

    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) renderAt(width)
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      cancelled = true
      ro.disconnect()
      renderTask?.cancel()
      doc?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, pageNumber])

  return { canvasRef, renderedWidth: size?.width ?? null, renderedHeight: size?.height ?? null, error }
}
