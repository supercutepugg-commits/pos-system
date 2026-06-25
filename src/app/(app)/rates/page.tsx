import RatesClient from './RatesClient'

export default function RatesPage() {
  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">요금 계산기</h1>
        <p className="text-sm text-slate-500 mt-0.5">통신사별 인터넷/결합 요금표 (26.05.11 기준)</p>
      </div>
      <RatesClient />
    </div>
  )
}
