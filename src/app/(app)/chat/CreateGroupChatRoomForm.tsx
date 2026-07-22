'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createGroupChatRoom } from './actions'

type TeamMemberOption = {
  id: string
  name: string
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  master: '마스터',
  admin: '관리자',
  sales: '영업팀',
  cs: 'CS팀',
  tech: '기술지원팀',
}

export default function CreateGroupChatRoomForm({ users }: { users: TeamMemberOption[] }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  function toggleMember(userId: string) {
    setMemberIds(current => current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId])
  }

  function close() {
    setOpen(false)
    setName('')
    setDescription('')
    setMemberIds([])
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const { error } = await createGroupChatRoom({ name, description, memberIds })
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`"${name.trim()}" 팀이 생성되었습니다.`)
    close()
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
      >
        <Plus size={15} />
        팀 추가
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={close}>
      <form
        onSubmit={handleSubmit}
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-team-title"
        className="w-full max-w-md rounded-2xl bg-indigo-50 p-5 shadow-xl"
      >
      <div className="mb-3 flex items-center justify-between">
        <div id="create-team-title" className="flex items-center gap-2 font-bold text-slate-900"><Users size={17} /> 새 팀</div>
        <button type="button" onClick={close} aria-label="닫기" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700">
          <X size={17} />
        </button>
      </div>
      <div className="grid gap-3">
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          required
          maxLength={50}
          placeholder="팀 이름 (예: 개발팀)"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={description}
          onChange={event => setDescription(event.target.value)}
          maxLength={200}
          placeholder="팀 설명 (선택)"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">구성원 선택 · 생성자는 자동 포함</p>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {users.map(user => (
              <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={memberIds.includes(user.id)}
                  onChange={() => toggleMember(user.id)}
                  className="size-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm font-medium text-slate-800">{user.name}</span>
                <span className="ml-auto text-xs text-slate-400">{ROLE_LABEL[user.role] ?? user.role}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? '생성 중...' : '팀 생성'}
        </button>
      </div>
      </form>
    </div>
  )
}
