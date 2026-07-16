import type { LucideIcon } from 'lucide-react'

const TONE_CLASSES = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  green: 'bg-green-50 text-green-600',
} as const

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  tone: keyof typeof TONE_CLASSES
}

export default function KpiCard({ label, value, icon: Icon, tone }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-xs text-slate-400">{label}</span>
        <span className="mt-1 block text-2xl font-bold text-slate-900">
          {value}
          <small className="ml-1 text-xs font-medium text-slate-400">건</small>
        </span>
      </span>
    </div>
  )
}
