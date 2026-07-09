import HistoryIcon from './HistoryIcon'

export default function HistoryButton({ onClick, label = '히스토리' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 bg-white px-2.5 py-1.5 rounded-lg transition-colors"
    >
      <HistoryIcon size={16} />
      {label}
    </button>
  )
}
