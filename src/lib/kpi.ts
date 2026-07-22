import type { ApprovalRole, Role } from '@/types'

export type KpiProfile = {
  id: string
  name: string
  role: Role
  approval_role?: ApprovalRole | null
}

export type KpiScore = {
  userId: string
  name: string
  roleLabel: string
  score: number
}

const ROLE_LABEL: Record<Role, string> = {
  sales: '영업',
  cs: 'CS',
  tech: '기술지원',
  admin: '관리자',
  master: '마스터',
}

const APPROVAL_ROLE_LABEL: Partial<Record<ApprovalRole, string>> = {
  cs_manager: 'CS매니저',
  cs_responsible: 'CS책임',
  tech_manager: '기술지원매니저',
  tech_responsible: '기술지원책임',
  team_lead: '팀장',
}

export function kpiRoleLabel(profile: KpiProfile) {
  return profile.approval_role
    ? APPROVAL_ROLE_LABEL[profile.approval_role] ?? ROLE_LABEL[profile.role]
    : ROLE_LABEL[profile.role]
}

export function isKpiTarget(profile: KpiProfile) {
  return profile.role === 'cs'
    || profile.role === 'tech'
    || ['cs_manager', 'cs_responsible', 'tech_manager', 'tech_responsible', 'team_lead'].includes(profile.approval_role ?? '')
}

export function addKpiPenalty(penalties: Map<string, number>, userId: string | null | undefined, amount: number) {
  if (!userId || amount <= 0) return
  penalties.set(userId, (penalties.get(userId) ?? 0) + amount)
}

export function businessHoursBetween(startValue: string, endValue: string) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0

  const kstOffset = 9 * 60 * 60 * 1000
  const shiftedStart = new Date(start.getTime() + kstOffset)
  const shiftedEnd = new Date(end.getTime() + kstOffset)
  const firstDay = Date.UTC(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate())
  const lastDay = Date.UTC(shiftedEnd.getUTCFullYear(), shiftedEnd.getUTCMonth(), shiftedEnd.getUTCDate())
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

export function buildKpiScores(profiles: KpiProfile[], penalties: Map<string, number>): KpiScore[] {
  const members = profiles.filter(profile => isKpiTarget(profile) && profile.approval_role !== 'team_lead')
  const averageMemberPenalty = members.length
    ? members.reduce((sum, profile) => sum + (penalties.get(profile.id) ?? 0), 0) / members.length
    : 0

  return profiles.filter(isKpiTarget).map(profile => {
    const penalty = profile.approval_role === 'team_lead'
      ? averageMemberPenalty * 1.5
      : penalties.get(profile.id) ?? 0
    return {
      userId: profile.id,
      name: profile.name,
      roleLabel: kpiRoleLabel(profile),
      score: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    }
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'))
}
