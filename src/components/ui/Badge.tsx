export default function Badge({ colorClass, children }: { colorClass: string; children: React.ReactNode }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border border-black/5 whitespace-nowrap ${colorClass}`}>
      {children}
    </span>
  )
}
