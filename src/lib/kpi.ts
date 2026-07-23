import type { ApprovalRole, Role } from '@/types'

export type KpiProfile = {
  id: string
  name: string
  role: Role
  team?: string | null
  approval_role?: ApprovalRole | null
}

export type KpiMetrics = {
  processed: number
  onTime: number
  successful: number
}

export type KpiScore = {
  userId: string
  name: string
  roleLabel: string
  score: number
}

export type KpiCalculationItem = {
  key: 'volume' | 'speed' | 'quality'
  label: string
  numerator: number
  denominator: number
  score: number
  maxScore: number
}

export type KpiScoreDetail = KpiScore & {
  items: KpiCalculationItem[]
  teamLeadCalculation?: {
    averageScore: number
    multiplier: number
    totalDeduction: number
  }
  teamMembers?: KpiScore[]
}

const ROLE_LABEL: Record<Role, string> = {
  sales: '영업',
  cs: 'CS',
  tech: '기술지원',
  admin: '관리자',
  master: '마스터',
  developer: '개발자',
}

const APPROVAL_ROLE_LABEL: Partial<Record<ApprovalRole, string>> = {
  cs_manager: 'CS매니저',
  cs_responsible: 'CS책임',
  tech_manager: '기술지원매니저',
  tech_responsible: '기술지원책임',
  team_lead: '팀장',
  developer: '개발자',
  test_account: '테스트계정',
}

export function kpiRoleLabel(profile: KpiProfile) {
  return profile.approval_role
    ? (APPROVAL_ROLE_LABEL[profile.approval_role] ?? ROLE_LABEL[profile.role])
    : ROLE_LABEL[profile.role]
}

export function isKpiTarget(profile: KpiProfile) {
  if (
    profile.role === 'developer' ||
    profile.approval_role === 'developer' ||
    profile.approval_role === 'test_account' ||
    profile.team === 'dev'
  ) return false
  return (
    profile.role === 'cs' ||
    profile.role === 'tech' ||
    [
      'cs_manager',
      'cs_responsible',
      'tech_manager',
      'tech_responsible',
      'team_lead',
    ].includes(profile.approval_role ?? '')
  )
}

export function addKpiResult(
  metrics: Map<string, KpiMetrics>,
  userId: string | null | undefined,
  result: { onTime: boolean; successful: boolean },
) {
  if (!userId) return
  const current = metrics.get(userId) ?? {
    processed: 0,
    onTime: 0,
    successful: 0,
  }
  metrics.set(userId, {
    processed: current.processed + 1,
    onTime: current.onTime + Number(result.onTime),
    successful: current.successful + Number(result.successful),
  })
}

export function businessHoursBetween(startValue: string, endValue: string) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  )
    return 0

  const kstOffset = 9 * 60 * 60 * 1000
  const shiftedStart = new Date(start.getTime() + kstOffset)
  const shiftedEnd = new Date(end.getTime() + kstOffset)
  const firstDay = Date.UTC(
    shiftedStart.getUTCFullYear(),
    shiftedStart.getUTCMonth(),
    shiftedStart.getUTCDate(),
  )
  const lastDay = Date.UTC(
    shiftedEnd.getUTCFullYear(),
    shiftedEnd.getUTCMonth(),
    shiftedEnd.getUTCDate(),
  )
  let milliseconds = 0

  for (let day = firstDay; day <= lastDay; day += 24 * 60 * 60 * 1000) {
    const weekday = new Date(day).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    const businessStart = day + 9 * 60 * 60 * 1000
    const businessEnd = day + 18 * 60 * 60 * 1000
    const overlapStart = Math.max(shiftedStart.getTime(), businessStart)
    const overlapEnd = Math.min(shiftedEnd.getTime(), businessEnd)
    if (overlapEnd > overlapStart) milliseconds += overlapEnd - overlapStart
  }

  return milliseconds / (60 * 60 * 1000)
}

function rounded(value: number) {
  return Math.round(value * 10) / 10
}

export function buildKpiScoreDetails(
  profiles: KpiProfile[],
  metrics: Map<string, KpiMetrics>,
  periodTarget: number,
): KpiScoreDetail[] {
  const targets = profiles.filter(isKpiTarget)
  const members = targets.filter(
    (profile) => profile.approval_role !== 'team_lead',
  )
  const memberDetails = members.map((profile) => {
    const result = metrics.get(profile.id) ?? {
      processed: 0,
      onTime: 0,
      successful: 0,
    }
    const volumeScore = Math.min(result.processed / periodTarget, 1) * 40
    const speedScore = result.processed
      ? Math.min(result.onTime / result.processed, 1) * 30
      : 0
    const qualityScore = result.processed
      ? Math.min(result.successful / result.processed, 1) * 30
      : 0
    return {
      userId: profile.id,
      name: profile.name,
      roleLabel: kpiRoleLabel(profile),
      score: Math.round(volumeScore + speedScore + qualityScore),
      items: [
        {
          key: 'volume' as const,
          label: '처리량',
          numerator: result.processed,
          denominator: periodTarget,
          score: rounded(volumeScore),
          maxScore: 40,
        },
        {
          key: 'speed' as const,
          label: '처리속도',
          numerator: result.onTime,
          denominator: result.processed,
          score: rounded(speedScore),
          maxScore: 30,
        },
        {
          key: 'quality' as const,
          label: '처리품질',
          numerator: result.successful,
          denominator: result.processed,
          score: rounded(qualityScore),
          maxScore: 30,
        },
      ],
    }
  })

  const averageMemberScore = memberDetails.length
    ? memberDetails.reduce((sum, member) => sum + member.score, 0) /
      memberDetails.length
    : 0
  const teamLeadDeduction = (100 - averageMemberScore) * 1.5
  const teamLeadScore = Math.max(
    0,
    Math.min(100, Math.round(100 - teamLeadDeduction)),
  )
  const memberScores: KpiScore[] = memberDetails.map((member) => ({
    userId: member.userId,
    name: member.name,
    roleLabel: member.roleLabel,
    score: member.score,
  }))
  const teamLeadDetails = targets
    .filter((profile) => profile.approval_role === 'team_lead')
    .map((profile) => ({
      userId: profile.id,
      name: profile.name,
      roleLabel: kpiRoleLabel(profile),
      score: teamLeadScore,
      items: [],
      teamLeadCalculation: {
        averageScore: rounded(averageMemberScore),
        multiplier: 1.5,
        totalDeduction: rounded(teamLeadDeduction),
      },
      teamMembers: memberScores,
    }))

  return [...memberDetails, ...teamLeadDetails].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'),
  )
}
