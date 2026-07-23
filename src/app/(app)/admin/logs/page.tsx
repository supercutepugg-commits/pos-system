import { redirect } from 'next/navigation'
import { requireMaster } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import LogsClient, { type EmployeeActivityLog } from './LogsClient'

type Relation<T> = T | T[] | null

type FranchiseLogRow = {
  id: string
  from_status: string | null
  to_status: string | null
  details: Record<string, unknown> | null
  created_at: string
  user_name: string | null
  user: Relation<{ name: string }>
  franchise_application: Relation<{ business_name: string; owner_name: string }>
}

type InstallationLogRow = {
  id: string
  action: string
  from_status: string | null
  to_status: string | null
  details: Record<string, unknown> | null
  created_at: string
  user_name: string | null
  user: Relation<{ name: string }>
  installation: Relation<{ customer_name: string }>
}

type TicketLogRow = {
  id: string
  from_status: string | null
  to_status: string | null
  message: string | null
  created_at: string
  user: Relation<{ name: string }>
  ticket: Relation<{ title: string; merchant: Relation<{ business_name: string }> }>
}

type InventoryLogRow = {
  id: string
  item_name: string
  change: number
  reason: string | null
  created_at: string
  user: Relation<{ name: string }>
}

function one<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

function kstDateRange(date: string | null) {
  if (!date) return null
  const start = new Date(`${date}T00:00:00+09:00`)
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; before?: string }>
}) {
  const authError = await requireMaster()
  if (authError) redirect('/dashboard')

  const { date, before } = await searchParams
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  const beforeDate = before ? new Date(before) : null
  const beforeCursor = !selectedDate && beforeDate && !Number.isNaN(beforeDate.getTime())
    ? beforeDate.toISOString()
    : null
  const range = kstDateRange(selectedDate)
  const supabase = await createClient()

  let franchiseQuery = supabase
    .from('franchise_application_logs')
    .select('id,from_status,to_status,details,created_at,user_name,user:profiles(name),franchise_application:franchise_applications(business_name,owner_name)')
    .order('created_at', { ascending: false })
  let installationQuery = supabase
    .from('installation_activity_logs')
    .select('id,action,from_status,to_status,details,created_at,user_name,user:profiles!installation_activity_logs_user_id_fkey(name),installation:installations(customer_name)')
    .order('created_at', { ascending: false })
  let ticketQuery = supabase
    .from('ticket_logs')
    .select('id,from_status,to_status,message,created_at,user:profiles(name),ticket:tickets(title,merchant:merchants(business_name))')
    .order('created_at', { ascending: false })
  let inventoryQuery = supabase
    .from('inventory_logs')
    .select('id,item_name,change,reason,created_at,user:profiles!inventory_logs_user_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (range) {
    franchiseQuery = franchiseQuery.gte('created_at', range.start).lt('created_at', range.end)
    installationQuery = installationQuery.gte('created_at', range.start).lt('created_at', range.end)
    ticketQuery = ticketQuery.gte('created_at', range.start).lt('created_at', range.end)
    inventoryQuery = inventoryQuery.gte('created_at', range.start).lt('created_at', range.end)
  } else {
    if (beforeCursor) {
      franchiseQuery = franchiseQuery.lt('created_at', beforeCursor)
      installationQuery = installationQuery.lt('created_at', beforeCursor)
      ticketQuery = ticketQuery.lt('created_at', beforeCursor)
      inventoryQuery = inventoryQuery.lt('created_at', beforeCursor)
    }
    franchiseQuery = franchiseQuery.limit(301)
    installationQuery = installationQuery.limit(301)
    ticketQuery = ticketQuery.limit(301)
    inventoryQuery = inventoryQuery.limit(301)
  }

  const [franchiseResult, installationResult, ticketResult, inventoryResult] = await Promise.all([
    franchiseQuery,
    installationQuery,
    ticketQuery,
    inventoryQuery,
  ])

  const franchiseLogs = (franchiseResult.data ?? []) as unknown as FranchiseLogRow[]
  const installationLogs = (installationResult.data ?? []) as unknown as InstallationLogRow[]
  const ticketLogs = (ticketResult.data ?? []) as unknown as TicketLogRow[]
  const inventoryLogs = (inventoryResult.data ?? []) as unknown as InventoryLogRow[]

  const combinedLogs: EmployeeActivityLog[] = [
    ...franchiseLogs.map(log => {
      const subject = one(log.franchise_application)
      return {
        id: `franchise-${log.id}`,
        source: 'franchise' as const,
        sourceLabel: '가맹접수',
        actorName: log.user_name ?? one(log.user)?.name ?? '알 수 없음',
        subject: subject?.business_name || subject?.owner_name || '삭제된 가맹접수',
        fromStatus: log.from_status,
        toStatus: log.to_status,
        details: log.details,
        description: null,
        createdAt: log.created_at,
      }
    }),
    ...installationLogs.map(log => ({
      id: `installation-${log.id}`,
      source: 'installation' as const,
      sourceLabel: '설치',
      actorName: log.user_name ?? one(log.user)?.name ?? '알 수 없음',
      subject: one(log.installation)?.customer_name || '삭제된 설치건',
      fromStatus: log.from_status,
      toStatus: log.to_status,
      details: log.details,
      description: log.action,
      createdAt: log.created_at,
    })),
    ...ticketLogs.map(log => {
      const ticket = one(log.ticket)
      return {
        id: `ticket-${log.id}`,
        source: 'ticket' as const,
        sourceLabel: '작업',
        actorName: one(log.user)?.name ?? '알 수 없음',
        subject: one(ticket?.merchant ?? null)?.business_name || ticket?.title || '삭제된 작업',
        fromStatus: log.from_status,
        toStatus: log.to_status,
        details: null,
        description: log.message,
        createdAt: log.created_at,
      }
    }),
    ...inventoryLogs.map(log => ({
      id: `inventory-${log.id}`,
      source: 'inventory' as const,
      sourceLabel: '재고',
      actorName: one(log.user)?.name ?? '알 수 없음',
      subject: log.item_name,
      fromStatus: null,
      toStatus: null,
      details: null,
      description: `수량 ${log.change > 0 ? '+' : ''}${log.change}${log.reason ? ` · ${log.reason}` : ''}`,
      createdAt: log.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const hasOlderLogs = !selectedDate && combinedLogs.length > 300
  const logs = selectedDate ? combinedLogs : combinedLogs.slice(0, 300)
  const nextCursor = hasOlderLogs ? logs.at(-1)?.createdAt ?? null : null

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">직원 활동 로그</h1>
        <p className="mt-1 text-sm text-slate-500">
          {selectedDate
            ? `${selectedDate} 업무 처리 이력`
            : beforeCursor
              ? '가맹접수·설치·작업·재고 이전 이력'
              : '가맹접수·설치·작업·재고 통합 이력 (페이지당 300건)'}
        </p>
      </div>

      <LogsClient
        logs={logs}
        selectedDate={selectedDate}
        nextCursor={nextCursor}
        isOlderPage={beforeCursor !== null}
      />
    </div>
  )
}
