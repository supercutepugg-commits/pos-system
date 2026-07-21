'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDeletePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { sendApprovedInstallNotification } from '@/lib/installNotifications'

const INSTALL_STATUSES = new Set(['received', 'preparing', 'scheduled', 'in_transit', 'delivery_sent', 'completed', 'rejected'])
const APPROVAL_STATUSES = new Set(['preparing', 'scheduled', 'in_transit', 'delivery_sent', 'completed'])
const APPROVAL_STATUS_LABEL: Record<string, string> = {
  preparing: '제품준비', scheduled: '일정확정', in_transit: '출발', delivery_sent: '택배발송', completed: '완료',
}

async function getInstallationEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, approval_role')
    .eq('id', user.id)
    .single()
  if (!profile || !['tech', 'cs', 'admin', 'master'].includes(profile.role)) {
    return { error: '설치건 변경 권한이 없습니다.' as const }
  }
  return { user, profile }
}

export async function createInstallation(input: {
  customerName: string
  customerPhone: string | null
  assignedTo: string | null
  notes: string | null
  items: { name: string; quantity: number }[]
  deliveryType: string
}) {
  const editor = await getInstallationEditor()
  if ('error' in editor) return { error: editor.error, installation: null }
  if (!input.customerName.trim()) return { error: '고객명을 입력해주세요.', installation: null }
  if (!['install', 'delivery', 'as', 'name_change', 'transfer'].includes(input.deliveryType)) {
    return { error: '잘못된 작업 유형입니다.', installation: null }
  }

  const admin = createAdminClient()
  const { data: installation, error: insertError } = await admin.from('installations').insert({
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone,
    assigned_to: input.assignedTo,
    notes: input.notes,
    items: input.items,
    delivery_type: input.deliveryType,
    created_by: editor.user.id,
    status: 'received',
    sort_order: Date.now(),
  }).select('*').single()
  if (insertError || !installation) return { error: insertError?.message ?? '설치건 등록에 실패했습니다.', installation: null }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: installation.id,
    user_id: editor.user.id,
    action: 'created',
    to_status: 'received',
    to_assigned_to: input.assignedTo,
    details: { delivery_type: input.deliveryType },
  })
  if (logError) {
    await admin.from('installations').delete().eq('id', installation.id)
    return { error: '감사 로그 저장에 실패해 등록을 취소했습니다: ' + logError.message, installation: null }
  }
  revalidatePath('/installs')
  return { error: null, installation }
}

export async function changeInstallationStatus(input: {
  installationId: string
  status: string
  scheduledDate?: string
  scheduledTime?: string
  eta?: string
  skipNotify?: boolean
  notes?: string
}) {
  const editor = await getInstallationEditor()
  if ('error' in editor) return { error: editor.error, notificationError: null }
  if (!INSTALL_STATUSES.has(input.status) || input.status === 'completed') {
    return { error: '잘못된 상태 변경 요청입니다.', notificationError: null }
  }
  if (APPROVAL_STATUSES.has(input.status)) {
    return { error: '이 단계는 승인요청 후 팀장 최종 승인이 필요합니다.', notificationError: null }
  }
  if (input.status === 'scheduled' && (!input.scheduledDate || !input.scheduledTime)) {
    return { error: '일정 날짜와 시간이 필요합니다.', notificationError: null }
  }

  const admin = createAdminClient()
  const { data: installation, error: lookupError } = await admin
    .from('installations')
    .select('status, scheduled_date, scheduled_time, notes')
    .eq('id', input.installationId)
    .single()
  if (lookupError || !installation) return { error: lookupError?.message ?? '설치건을 찾을 수 없습니다.', notificationError: null }

  const values: Record<string, string> = { status: input.status, updated_at: new Date().toISOString() }
  if (input.status === 'scheduled') {
    values.scheduled_date = input.scheduledDate!
    values.scheduled_time = input.scheduledTime!
  }
  if (input.status === 'rejected') values.notes = input.notes ?? ''

  const { data: updated, error: updateError } = await admin
    .from('installations')
    .update(values)
    .eq('id', input.installationId)
    .eq('status', installation.status)
    .select('id')
    .maybeSingle()
  if (updateError || !updated) return { error: updateError?.message ?? '다른 사용자가 먼저 상태를 변경했습니다.', notificationError: null }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: input.installationId,
    user_id: editor.user.id,
    action: 'status_changed',
    from_status: installation.status,
    to_status: input.status,
    details: {
      ...(input.eta ? { eta: input.eta } : {}),
      ...(input.status === 'scheduled' ? { scheduled_date: input.scheduledDate, scheduled_time: input.scheduledTime } : {}),
      ...(input.status === 'rejected' ? { reason: input.notes ?? '' } : {}),
    },
  })
  if (logError) {
    await admin.from('installations').update({
      status: installation.status,
      scheduled_date: installation.scheduled_date,
      scheduled_time: installation.scheduled_time,
      notes: installation.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', input.installationId).eq('status', input.status)
    return { error: '감사 로그 저장에 실패해 상태 변경을 취소했습니다: ' + logError.message, notificationError: null }
  }

  const notification = input.skipNotify
    ? { error: null }
    : await sendApprovedInstallNotification({
      installationId: input.installationId,
      status: input.status,
      userId: editor.user.id,
      eta: input.eta,
    })
  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null, notificationError: notification.error }
}

export async function changeInstallationAssignment(installationId: string, assignedTo: string | null) {
  const editor = await getInstallationEditor()
  if ('error' in editor) return { error: editor.error }

  const admin = createAdminClient()
  const { data: installation, error: lookupError } = await admin
    .from('installations')
    .select('assigned_to')
    .eq('id', installationId)
    .single()
  if (lookupError || !installation) return { error: lookupError?.message ?? '설치건을 찾을 수 없습니다.' }

  let updateQuery = admin
    .from('installations')
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .eq('id', installationId)
  updateQuery = installation.assigned_to
    ? updateQuery.eq('assigned_to', installation.assigned_to)
    : updateQuery.is('assigned_to', null)
  const { data: updated, error: updateError } = await updateQuery.select('id').maybeSingle()
  if (updateError || !updated) return { error: updateError?.message ?? '담당자가 이미 변경됐습니다.' }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: installationId,
    user_id: editor.user.id,
    action: 'assignment_changed',
    from_assigned_to: installation.assigned_to,
    to_assigned_to: assignedTo,
  })
  if (logError) {
    let rollbackQuery = admin.from('installations').update({ assigned_to: installation.assigned_to }).eq('id', installationId)
    rollbackQuery = assignedTo ? rollbackQuery.eq('assigned_to', assignedTo) : rollbackQuery.is('assigned_to', null)
    await rollbackQuery
    return { error: '감사 로그 저장에 실패해 배정 변경을 취소했습니다: ' + logError.message }
  }
  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null }
}

export async function requestInstallationStatusApproval(input: {
  installationId: string
  targetStatus: string
  scheduledDate?: string
  scheduledTime?: string
  eta?: string
  skipNotify?: boolean
}) {
  const editor = await getInstallationEditor()
  if ('error' in editor) return { error: editor.error, approvalId: null }
  if (editor.profile.approval_role !== 'tech_manager') {
    return { error: '기술지원매니저만 단계 승인을 요청할 수 있습니다.', approvalId: null }
  }
  if (!APPROVAL_STATUSES.has(input.targetStatus)) {
    return { error: '승인을 요청할 수 없는 상태입니다.', approvalId: null }
  }
  if (input.targetStatus === 'scheduled' && (!input.scheduledDate || !input.scheduledTime)) {
    return { error: '일정 날짜와 시간이 필요합니다.', approvalId: null }
  }

  const admin = createAdminClient()
  const { data: installation } = await admin.from('installations').select('status').eq('id', input.installationId).single()
  if (!installation || ['completed', 'rejected'].includes(installation.status)) {
    return { error: '단계 승인을 요청할 수 없는 설치건입니다.', approvalId: null }
  }
  const { data: approval, error: approvalError } = await admin
    .from('installation_completion_approvals')
    .insert({
      installation_id: input.installationId,
      target_status: input.targetStatus,
      request_payload: {
        ...(input.scheduledDate ? { scheduled_date: input.scheduledDate } : {}),
        ...(input.scheduledTime ? { scheduled_time: input.scheduledTime } : {}),
        ...(input.eta ? { eta: input.eta } : {}),
        ...(input.skipNotify ? { skip_notify: true } : {}),
      },
      status: 'requested',
      requested_by: editor.user.id,
      requested_by_name: editor.profile.name,
      approved_by: null,
      approved_by_name: null,
    })
    .select('id')
    .single()
  if (approvalError || !approval) return { error: approvalError?.message ?? '승인요청 저장에 실패했습니다.', approvalId: null }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: input.installationId,
    user_id: editor.user.id,
    action: 'step_approval_requested',
    from_status: installation.status,
    to_status: input.targetStatus,
    approval_id: approval.id,
    details: { target_status: input.targetStatus },
  })
  if (logError) {
    await admin.from('installation_completion_approvals').delete().eq('id', approval.id)
    return { error: '감사 로그 저장에 실패해 승인요청을 취소했습니다: ' + logError.message, approvalId: null }
  }
  const { data: approvers } = await admin.from('profiles').select('id').eq('approval_role', 'tech_responsible').neq('id', editor.user.id)
  const { error: notificationError } = approvers?.length
    ? await admin.from('notifications').insert(approvers.map(approver => ({
      user_id: approver.id,
      installation_id: input.installationId,
      type: 'approval_install_step',
      title: '[1차 승인요청] 기술지원 단계',
      body: `${editor.profile.name}님이 ${APPROVAL_STATUS_LABEL[input.targetStatus]} 단계 승인을 요청했습니다.`,
    })))
    : { error: null }
  revalidatePath('/dashboard')
  return { error: null, approvalId: approval.id, notificationError: notificationError?.message ?? null }
}

export async function requestInstallationCompletion(installationId: string, skipNotify = false) {
  return requestInstallationStatusApproval({ installationId, targetStatus: 'completed', skipNotify })
}

export async function approveInstallationCompletion(installationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', notificationError: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, approval_role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.approval_role !== 'tech_responsible') {
    return { error: '승인 권한이 없습니다.', notificationError: null }
  }

  const admin = createAdminClient()
  const { data: approval } = await admin
    .from('installation_completion_approvals')
    .select('id, requested_by, target_status')
    .eq('installation_id', installationId)
    .eq('status', 'requested')
    .single()
  if (!approval) return { error: '처리할 승인 요청이 없습니다.', notificationError: null }
  if (approval.requested_by === user.id) {
    return { error: '요청자는 직접 승인할 수 없습니다.', notificationError: null }
  }

  const approvedAt = new Date().toISOString()
  const { data: updatedApproval, error: approvalError } = await admin
    .from('installation_completion_approvals')
    .update({
      status: 'responsible_approved',
      responsible_approved_by: user.id,
      responsible_approved_by_name: profile.name,
      responsible_approved_at: approvedAt,
    })
    .eq('id', approval.id)
    .eq('status', 'requested')
    .select('id')
    .maybeSingle()
  if (approvalError || !updatedApproval) return { error: approvalError?.message ?? '다른 사용자가 먼저 승인했습니다.', notificationError: null }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: installationId,
    user_id: user.id,
    action: 'step_responsible_approved',
    to_status: approval.target_status,
    approval_id: approval.id,
  })
  if (logError) {
    await admin.from('installation_completion_approvals').update({
      status: 'requested',
      responsible_approved_by: null,
      responsible_approved_by_name: null,
      responsible_approved_at: null,
    }).eq('id', approval.id).eq('status', 'responsible_approved')
    return { error: '감사 로그 저장에 실패해 승인을 취소했습니다: ' + logError.message, notificationError: null }
  }

  const { data: teamLeads } = await admin.from('profiles').select('id').eq('approval_role', 'team_lead').neq('id', user.id).neq('id', approval.requested_by)
  const { error: notificationError } = teamLeads?.length
    ? await admin.from('notifications').insert(teamLeads.map(teamLead => ({
      user_id: teamLead.id,
      installation_id: installationId,
      type: 'approval_install_step_final',
      title: '[최종 승인요청] 기술지원 단계',
      body: `${profile.name}님이 1차 승인했습니다. 팀장 최종 승인이 필요합니다.`,
    })))
    : { error: null }

  revalidatePath('/dashboard')
  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null, notificationError: notificationError?.message ?? null }
}

export async function approveInstallationStatusByTeamLead(installationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', notificationError: null }
  const { data: profile } = await supabase.from('profiles').select('name, approval_role').eq('id', user.id).single()
  if (!profile || profile.approval_role !== 'team_lead') return { error: '팀장 최종 승인 권한이 없습니다.', notificationError: null }

  const admin = createAdminClient()
  const { data: approval } = await admin.from('installation_completion_approvals')
    .select('id, requested_by, target_status, request_payload')
    .eq('installation_id', installationId)
    .eq('status', 'responsible_approved')
    .single()
  if (!approval) return { error: '처리할 최종 승인 요청이 없습니다.', notificationError: null }
  if (approval.requested_by === user.id) return { error: '요청자는 직접 승인할 수 없습니다.', notificationError: null }

  const { data: installation } = await admin.from('installations').select('status, scheduled_date, scheduled_time').eq('id', installationId).single()
  if (!installation) return { error: '설치건을 찾을 수 없습니다.', notificationError: null }
  const payload = (approval.request_payload ?? {}) as { scheduled_date?: string; scheduled_time?: string; eta?: string; skip_notify?: boolean }
  const approvedAt = new Date().toISOString()
  const { data: finalApproval, error: approvalError } = await admin.from('installation_completion_approvals').update({
    status: 'approved', approved_by: user.id, approved_by_name: profile.name, approved_at: approvedAt,
  }).eq('id', approval.id).eq('status', 'responsible_approved').select('id').maybeSingle()
  if (approvalError || !finalApproval) return { error: approvalError?.message ?? '다른 사용자가 먼저 승인했습니다.', notificationError: null }

  const values: Record<string, string> = { status: approval.target_status, updated_at: approvedAt }
  if (approval.target_status === 'scheduled') {
    if (!payload.scheduled_date || !payload.scheduled_time) {
      await admin.from('installation_completion_approvals').update({ status: 'responsible_approved', approved_by: null, approved_by_name: null, approved_at: null }).eq('id', approval.id)
      return { error: '승인요청에 일정 정보가 없습니다.', notificationError: null }
    }
    values.scheduled_date = payload.scheduled_date
    values.scheduled_time = payload.scheduled_time
  }
  const { data: updated, error: updateError } = await admin.from('installations').update(values)
    .eq('id', installationId).eq('status', installation.status).select('id').maybeSingle()
  if (updateError || !updated) {
    await admin.from('installation_completion_approvals').update({ status: 'responsible_approved', approved_by: null, approved_by_name: null, approved_at: null }).eq('id', approval.id)
    return { error: updateError?.message ?? '설치 상태가 변경되어 승인할 수 없습니다.', notificationError: null }
  }

  const { error: logError } = await admin.from('installation_activity_logs').insert({
    installation_id: installationId, user_id: user.id, action: 'step_final_approved',
    from_status: installation.status, to_status: approval.target_status, approval_id: approval.id,
    details: payload,
  })
  if (logError) {
    await Promise.all([
      admin.from('installations').update({ status: installation.status, scheduled_date: installation.scheduled_date, scheduled_time: installation.scheduled_time }).eq('id', installationId).eq('status', approval.target_status),
      admin.from('installation_completion_approvals').update({ status: 'responsible_approved', approved_by: null, approved_by_name: null, approved_at: null }).eq('id', approval.id),
    ])
    return { error: '감사 로그 저장에 실패해 최종 승인을 취소했습니다: ' + logError.message, notificationError: null }
  }

  const notification = payload.skip_notify
    ? { error: null }
    : await sendApprovedInstallNotification({
      installationId, status: approval.target_status, userId: user.id, eta: payload.eta,
    })
  revalidatePath('/dashboard')
  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null, notificationError: notification.error }
}

export async function deleteInstallations(ids: string[]) {
  const authError = await requireDeletePermission()
  if (authError) return { error: authError }

  if (!Array.isArray(ids)) return { error: '잘못된 삭제 요청입니다.' }

  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (!uniqueIds.length) return { error: null }
  if (uniqueIds.length > 300) {
    return { error: '한 번에 삭제할 수 있는 설치건은 최대 300건입니다.' }
  }

  const admin = createAdminClient()
  const { data: targets, error: lookupError } = await admin
    .from('installations')
    .select('id, franchise_application_id')
    .in('id', uniqueIds)

  if (lookupError) return { error: lookupError.message }
  if ((targets?.length ?? 0) !== uniqueIds.length) {
    return { error: '삭제할 설치건을 찾을 수 없습니다. 목록을 새로고침해 주세요.' }
  }

  const linkedTargets = targets?.filter(target => target.franchise_application_id) ?? []
  if (linkedTargets.length > 0) {
    return { error: '가맹접수에서 이관된 설치건은 삭제할 수 없습니다.' }
  }

  const { data: deleted, error: deleteError } = await admin
    .from('installations')
    .delete()
    .in('id', uniqueIds)
    .is('franchise_application_id', null)
    .select('id')

  if (deleteError) return { error: deleteError.message }
  if ((deleted?.length ?? 0) !== uniqueIds.length) {
    return { error: '일부 설치건이 가맹접수와 연결되어 삭제되지 않았습니다. 목록을 새로고침해 주세요.' }
  }

  revalidatePath('/installs')
  revalidatePath('/installs/mine')
  return { error: null }
}
