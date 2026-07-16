'use client'

import { useRef, useState } from 'react'
import { ArrowUp, Pin, Trash2, XIcon } from 'lucide-react'
import type { FranchiseApplication } from '@/types'
import { APPLICANT_TYPE_LABEL } from '@/types'

export interface FranchiseMemoEntry {
  index: number
  at: string
  user: string
  text: string
  pinned: boolean
  pinnedAt: string | null
}

interface Props {
  row: FranchiseApplication
  entries: FranchiseMemoEntry[]
  onClose: () => void
  onAdd: (content: string) => void | Promise<void>
  onTogglePin: (index: number) => void | Promise<void>
  onDelete: (index: number) => void | Promise<void>
}

function formatEntryDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR')
}

export default function FranchiseMemoDrawer({ row, entries, onClose, onAdd, onTogglePin, onDelete }: Props) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.pinned && b.pinned) {
      return new Date(b.pinnedAt ?? b.at).getTime() - new Date(a.pinnedAt ?? a.at).getTime()
    }
    return new Date(b.at).getTime() - new Date(a.at).getTime()
  })

  function resizeTextarea() {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
  }

  async function submit() {
    const content = draft.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      await onAdd(content)
      setDraft('')
      requestAnimationFrame(resizeTextarea)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/35" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="franchise-memo-title"
        onMouseDown={event => event.stopPropagation()}
        className="bg-card text-foreground absolute inset-y-0 right-0 flex h-dvh w-[560px] max-w-[calc(100vw-32px)] flex-col shadow-2xl"
      >
        <header className="border-border flex flex-shrink-0 items-start justify-between border-b px-6 py-5">
          <div className="min-w-0">
            <h2 id="franchise-memo-title" className="truncate text-lg font-bold">{row.business_name || row.owner_name || '-'}</h2>
            <p className="text-muted-foreground mt-1 truncate text-[13.5px]">
              {row.owner_name || '-'} · {APPLICANT_TYPE_LABEL[row.applicant_type]} · {row.phone || '-'}
            </p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sortedEntries.length === 0 ? (
            <div className="text-muted-foreground flex h-full min-h-48 items-center justify-center text-sm">메모가 없습니다.</div>
          ) : (
            <ol className="flex flex-col gap-3">
              {sortedEntries.map(entry => (
                <li key={`${entry.index}-${entry.at}`} className={`group rounded-xl border px-4 py-3.5 ${entry.pinned ? 'border-primary/35 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs">{formatEntryDate(entry.at)} · {entry.user || '-'}</div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{entry.text}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={entry.pinned ? '고정 해제' : '상단 고정'}
                        onClick={() => onTogglePin(entry.index)}
                        className={entry.pinned ? 'text-primary hover:text-primary-hover inline-flex size-8 items-center justify-center rounded-lg' : 'text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-lg'}
                      >
                        <Pin className={`size-4 ${entry.pinned ? 'fill-current' : ''}`} />
                      </button>
                      <button type="button" aria-label="메모 삭제" onClick={() => onDelete(entry.index)} className="text-muted-foreground hover:bg-error/10 hover:text-error inline-flex size-8 items-center justify-center rounded-lg">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="border-border flex-shrink-0 border-t px-6 py-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              placeholder="새 히스토리 입력..."
              onChange={event => {
                setDraft(event.target.value)
                requestAnimationFrame(resizeTextarea)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 max-h-32 min-h-11 w-full resize-none rounded-2xl border py-2.5 pr-12 pl-4 text-sm leading-6 outline-none focus-visible:ring-2"
            />
            <button
              type="button"
              aria-label="메모 등록"
              disabled={!draft.trim() || submitting}
              onClick={() => void submit()}
              className="bg-primary text-primary-foreground hover:bg-primary-hover absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
