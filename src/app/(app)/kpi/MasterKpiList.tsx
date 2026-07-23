'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { KpiScoreDetail } from '@/lib/kpi'

function scoreTone(score: number) {
  if (score >= 90) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (score >= 80) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (score >= 70) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

function formatPoint(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export default function MasterKpiList({
  scores,
}: {
  scores: KpiScoreDetail[]
}) {
  const [selected, setSelected] = useState<KpiScoreDetail | null>(null)

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-bold text-slate-900">개인 KPI</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {scores.map((score) => (
            <button
              key={score.userId}
              type="button"
              onClick={() => setSelected(score)}
              className="group flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 underline-offset-4 group-hover:underline">
                  {score.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {score.roleLabel}
                </p>
              </div>
              <span
                className={`min-w-20 rounded-xl border px-4 py-2 text-center text-lg font-bold ${scoreTone(score.score)}`}
              >
                {score.score}점
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-detail-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2
                  id="kpi-detail-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.roleLabel} · 이번 달 KPI
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="space-y-5 px-6 py-5">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-5 py-4">
                <span className="text-sm font-semibold text-slate-600">
                  최종 점수
                </span>
                <span
                  className={`rounded-xl border px-4 py-2 text-2xl font-bold ${scoreTone(selected.score)}`}
                >
                  {selected.score}점
                </span>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-900">
                  점수 계산
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {selected.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-slate-700">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.numerator}/{item.denominator}건 반영
                        </p>
                      </div>
                      <strong className="shrink-0 text-slate-900">
                        {formatPoint(item.score)}/{item.maxScore}점
                      </strong>
                    </div>
                  ))}
                  {selected.teamLeadCalculation && (
                    <div className="space-y-2 bg-blue-50/50 px-4 py-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">팀원 평균 점수</span>
                        <strong>
                          {formatPoint(
                            selected.teamLeadCalculation.averageScore,
                          )}
                          점
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">관리책임 배수</span>
                        <strong>
                          × {selected.teamLeadCalculation.multiplier}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">반영 감점</span>
                        <strong className="text-red-600">
                          -
                          {formatPoint(
                            selected.teamLeadCalculation.totalDeduction,
                          )}
                          점
                        </strong>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-700">
                      최종 합계
                    </span>
                    <strong className="text-slate-900">
                      {selected.score}점
                    </strong>
                  </div>
                </div>
              </div>

              {!!selected.teamMembers?.length && (
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    팀원 반영 현황
                  </h3>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {selected.teamMembers.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.roleLabel}
                          </p>
                        </div>
                        <span className="font-semibold text-slate-700">
                          {member.score}점
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
