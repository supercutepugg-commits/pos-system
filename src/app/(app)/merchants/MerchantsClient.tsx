'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapPin, Phone, Trash2 } from 'lucide-react'
import { deleteMerchants } from './actions'

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

  async function handleDelete() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?\n해당 가맹점의 작업 내역도 함께 삭제됩니다.`)) return
    setDeleting(true)
    const { error } = await deleteMerchants([...selected])
    setDeleting(false)
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
          <span className="text-xs text-gray-400 font-medium">전체 선택</span>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 ml-2">
              <span className="text-sm font-semibold text-blue-700">{selected.size}건 선택됨</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                {deleting ? '삭제 중...' : '선택 삭제'}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {merchants.map(m => (
          <div
            key={m.id}
            className="relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
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
                  <p className="font-semibold text-gray-900">{m.business_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.owner_name}</p>
                </div>
                {m.pos_model && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.pos_model}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Phone size={11} />{m.phone}</span>
                <span className="flex items-center gap-1 truncate"><MapPin size={11} />{m.address}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>영업: {m.sales?.name ?? '-'}</span>
                <span>{format(new Date(m.created_at), 'M/d', { locale: ko })}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
