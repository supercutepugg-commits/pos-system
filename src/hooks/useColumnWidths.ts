import { useState, useRef, useEffect, useCallback } from 'react'

export function useColumnWidths(storageKey: string, defaultWidths: Record<string, number>) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') } catch { return {} }
  })
  const dragState = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragState.current) return
      const { key, startX, startWidth } = dragState.current
      const newWidth = Math.max(60, startWidth + (e.clientX - startX))
      setColWidths(prev => {
        const next = { ...prev, [key]: newWidth }
        localStorage.setItem(storageKey, JSON.stringify(next))
        return next
      })
    }
    function onUp() {
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [])

  const startResize = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragState.current = {
      key,
      startX: e.clientX,
      startWidth: colWidths[key] ?? defaultWidths[key] ?? 140,
    }
  }, [colWidths, defaultWidths])

  function widthOf(key: string) {
    return colWidths[key] ?? defaultWidths[key] ?? 140
  }

  return { colWidths, startResize, widthOf }
}
