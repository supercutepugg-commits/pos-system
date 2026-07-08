'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapPin, Phone } from 'lucide-react'
import { deleteMerchants } from './actions'
import EmptyState from '@/components/ui/EmptyState'
import BulkDeleteActions from '@/components/ui/BulkDeleteActions'
import BulkConfirmDialog from '@/components/ui/BulkConfirmDialog'

interface Merchant {
  id: string
  business_name: string
  owner_name?: string
  phone: string
  address: string
  pos_model?: string
  created_at: string
  sales?: { name: string } | null
}

export default function MerchantsClient({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const allChecked = merchants.length > 0 && selected.size === merchants.length

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(merchants.map(m => m.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDelete() {
    if (selected.size === 0) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    setDeleting(true)
    const { error } = await deleteMerchants([...selected])
    setDeleting(false)
    setDeleteConfirmOpen(false)
    if (error) { alert('삭제 실패: ' + error); return }
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  return (
    <div>
      {merchants.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span className="text-xs text-slate-400 font-medium">전체 선택</span>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 ml-2">
              <BulkDeleteActions count={selected.size} deleting={deleting} onDelete={handleDelete} onCancel={() => setSelected(new Set())} />
            </div>
          )}
        </div>
      )}

      {merchants.length === 0 && <EmptyState message="등록된 가맹점이 없습니다" />}

      <div className="grid gap-3 md:grid-cols-2">
        {merchants.map(m => (
          <div
            key={m.id}
            className="relative bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
          >
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggleOne(m.id)}
              className="absolute top-4 right-4 w-4 h-4 accent-blue-600 cursor-pointer z-10"
            />
            <Link href={`/merchants/${m.id}`} className="block pr-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-900">{m.business_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.owner_name}</p>
                </div>
                {m.pos_model && (
                  <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">{m.pos_model}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-700">
                <span className="flex items-center gap-1"><Phone size={11} />{m.phone}</span>
                <span className="flex items-center gap-1 truncate"><MapPin size={11} />{m.address}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>영업: <span className={m.sales?.name ? '' : 'text-slate-400'}>{m.sales?.name ?? '-'}</span></span>
                <span>{format(new Date(m.created_at), 'M/d', { locale: ko })}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <BulkConfirmDialog
        open={deleteConfirmOpen}
        title="선택 항목 삭제"
        busy={deleting}
        confirmText="삭제"
        confirmColor="red"
        items={merchants.filter(m => selected.has(m.id)).map(m => ({ id: m.id, label: m.business_name }))}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
