'use client'

import { useState, useMemo } from 'react'
import rateData from '@/data/rate-calculator.json'

interface RateItem {
  group: string
  label: string
  total: number
}
interface RateBlock {
  title: string
  items: RateItem[]
}
interface Carrier {
  key: string
  name: string
  blocks: RateBlock[]
}
interface InstallFeeItem {
  group: string
  label: string
  weekday: number
  weekend: number | null
}
interface InstallFee {
  carrier: string
  items: InstallFeeItem[]
}
interface RefundRule {
  title: string
  lines: string[]
}

const data = rateData as unknown as {
  carriers: Carrier[]
  installFees: InstallFee[]
  installFeeNotes: string[]
  refundRules: RefundRule[]
}

type Tab = 'calc' | 'install' | 'refund'

function won(n: number | null) {
  if (n === null || n === undefined) return '-'
  return n.toLocaleString() + '원'
}

export default function RatesClient() {
  const [tab, setTab] = useState<Tab>('calc')
  const [carrierKey, setCarrierKey] = useState(data.carriers[0]?.key ?? '')
  const [blockTitle, setBlockTitle] = useState(data.carriers[0]?.blocks[0]?.title ?? '')
  const [itemIdx, setItemIdx] = useState(0)

  const carrier = data.carriers.find(c => c.key === carrierKey) ?? data.carriers[0]
  const block = carrier?.blocks.find(b => b.title === blockTitle) ?? carrier?.blocks[0]
  const selectedItem = block?.items[itemIdx]

  const groupedItems = useMemo(() => {
    if (!block) return [] as { group: string; items: { item: RateItem; idx: number }[] }[]
    const map = new Map<string, { item: RateItem; idx: number }[]>()
    block.items.forEach((item, idx) => {
      const key = item.group || '기타'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ item, idx })
    })
    return [...map.entries()].map(([group, items]) => ({ group, items }))
  }, [carrierKey, blockTitle])

  function selectCarrier(key: string) {
    setCarrierKey(key)
    const c = data.carriers.find(c => c.key === key)
    setBlockTitle(c?.blocks[0]?.title ?? '')
    setItemIdx(0)
  }

  function selectBlock(title: string) {
    setBlockTitle(title)
    setItemIdx(0)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {([
          ['calc', '요금 계산기'],
          ['install', '설치비 / 프로모션'],
          ['refund', '환수 규정'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'calc' && (
        <div className="flex-1 overflow-auto flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {data.carriers.map(c => (
              <button key={c.key} onClick={() => selectCarrier(c.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  carrierKey === c.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {c.name}
              </button>
            ))}
          </div>

          {carrier && carrier.blocks.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {carrier.blocks.map(b => (
                <button key={b.title} onClick={() => selectBlock(b.title)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    blockTitle === b.title ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                  }`}>
                  {b.title}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[280px] max-w-md">
              <label className="text-xs font-medium text-slate-500 mb-1 block">결합/속도 선택</label>
              <select
                value={itemIdx}
                onChange={e => setItemIdx(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {groupedItems.map(g => (
                  <optgroup key={g.group} label={g.group || '기타'}>
                    {g.items.map(({ item, idx }) => (
                      <option key={idx} value={idx}>{item.label} — {won(item.total)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[200px]">
              <p className="text-xs text-blue-500 font-medium mb-1">총 요금</p>
              <p className="text-2xl font-bold text-blue-700">{selectedItem ? won(selectedItem.total) : '-'}</p>
              {selectedItem && <p className="text-xs text-blue-400 mt-1">{selectedItem.label}</p>}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">구분</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">결합/속도</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">총요금</th>
                </tr>
              </thead>
              <tbody>
                {block?.items.map((item, idx) => (
                  <tr key={idx} onClick={() => setItemIdx(idx)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${idx === itemIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-2 text-slate-500">{item.group}</td>
                    <td className="px-3 py-2 text-slate-800">{item.label}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{won(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'install' && (
        <div className="flex-1 overflow-auto flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.installFees.map(fee => (
              <div key={fee.carrier} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 font-semibold text-sm text-slate-700 border-b border-slate-200">{fee.carrier}</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="text-left px-2 py-1.5 text-slate-500">상품</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">평일</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">주말/야간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fee.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 text-slate-700">{item.label}</td>
                        <td className="px-2 py-1.5 text-right">{won(item.weekday)}</td>
                        <td className="px-2 py-1.5 text-right">{won(item.weekend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          {data.installFeeNotes.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">참고</p>
              <ul className="space-y-1">
                {data.installFeeNotes.map((n, i) => <li key={i} className="text-xs text-slate-500">{n}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'refund' && (
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.refundRules.map(rule => (
            <div key={rule.title} className="border border-slate-200 rounded-xl p-4">
              <p className="font-semibold text-slate-800 text-sm mb-2">{rule.title}</p>
              <ul className="space-y-1">
                {rule.lines.map((l, i) => <li key={i} className="text-xs text-slate-600 leading-relaxed">{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
