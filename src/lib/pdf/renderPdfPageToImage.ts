import 'server-only'
import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas'

// pdfjs-dist는 네이티브 DOMMatrix/Path2D가 전역에 없으면 순수 JS 폴백을 쓰며 경고를 낸다.
if (!('DOMMatrix' in globalThis)) (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix
if (!('Path2D' in globalThis)) (globalThis as Record<string, unknown>).Path2D = Path2D

function makeCanvasFactory() {
  return {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height)
      return { canvas, context: canvas.getContext('2d') }
    },
    reset(canvasAndContext: { canvas: { width: number; height: number } }, width: number, height: number) {
      canvasAndContext.canvas.width = width
      canvasAndContext.canvas.height = height
    },
    destroy(canvasAndContext: { canvas: unknown; context: unknown }) {
      canvasAndContext.canvas = null
      canvasAndContext.context = null
    },
  }
}

// 계약서 서명 페이지는 1페이지만 지원한다 (usePdfPageCanvas와 동일한 제약).
export async function renderPdfPageToPng(pdfBytes: Uint8Array, targetWidth = 1000): Promise<Buffer> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

  const canvasFactory = makeCanvasFactory()
  const loadingTask = getDocument({
    data: pdfBytes,
    canvasFactory,
    isEvalSupported: false,
    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
    cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
    cMapPacked: true,
  })

  const pdf = await loadingTask.promise
  try {
    const page = await pdf.getPage(1)
    const unscaled = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: targetWidth / unscaled.width })

    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height)
    // @napi-rs/canvas's context type doesn't structurally match the DOM CanvasRenderingContext2D
    // that pdfjs-dist's types expect, but it implements the subset pdfjs-dist actually calls at runtime.
    const renderTask = page.render({
      canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
      viewport,
    })
    await renderTask.promise

    return canvasAndContext.canvas.toBuffer('image/png')
  } finally {
    await pdf.destroy()
  }
}
