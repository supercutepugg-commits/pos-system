'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getApprover(requiredRole: 'tech_responsible' | 'team_lead') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, approval_role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.approval_role !== requiredRole) return { error: '승인 권한이 없습니다.' }

  return { user, profile }
}

export async function approveInstallationCompletion(installationId: string) {
  const approver = await getApprover('tech_responsible')
  if ('error' in approver) return approver

  const admin = createAdminClient()
  const { data: approval } = await admin
    .from('installation_completion_approvals')
    .select('requested_by')
    .eq('installation_id', installationId)
    .eq('status', 'requested')
    .single()
  if (!approval) return { error: '처리할 승인 요청이 없습니다.' }
  if (approval.requested_by === approver.user.id) return { error: '요청자는 직접 승인할 수 없습니다.' }

  const approvedAt = new Date().toISOString()
  const { error: approvalError } = await admin
    .from('installation_completion_approvals')
    .update({ status: 'approved', approved_by: approver.user.id, approved_by_name: approver.profile.name, approved_at: approvedAt })
    .eq('installation_id', installationId)
    .eq('status', 'requested')
  if (approvalError) return { error: approvalError.message }

  const { error } = await admin
    .from('installations')
    .update({ status: 'completed', updated_at: approvedAt })
    .eq('id', installationId)
  if (error) return { error: error.message }

  return { error: null }
}

export async function approveFranchiseTransfer(franchiseApplicationId: string) {
  const approver = await getApprover('team_lead')
  if ('error' in approver) return approver

  const admin = createAdminClient()
  const [{ data: approval }, { data: franchise }] = await Promise.all([
    admin.from('franchise_transfer_approvals').select('requested_by').eq('franchise_application_id', franchiseApplicationId).eq('status', 'requested').single(),
    admin.from('franchise_applications').select('id, business_name, owner_name, phone, equipment_items, memo, address, install_date, status').eq('id', franchiseApplicationId).single(),
  ])
  if (!approval || !franchise) return { error: '처리할 승인 요청이 없습니다.' }
  if (approval.requested_by === approver.user.id) return { error: '요청자는 직접 승인할 수 없습니다.' }

  const { data: existingInstall } = await admin
    .from('installations')
    .select('id, status')
    .eq('franchise_application_id', franchiseApplicationId)
    .maybeSingle()
  if (existingInstall && existingInstall.status !== 'rejected') return { error: '이미 기술지원으로 이관된 접수입니다.' }

  const approvedAt = new Date().toISOString()
  const { error: approvalError } = await admin
    .from('franchise_transfer_approvals')
    .update({ status: 'approved', approved_by: approver.user.id, approved_by_name: approver.profile.name, approved_at: approvedAt })
    .eq('franchise_application_id', franchiseApplicationId)
    .eq('status', 'requested')
  if (approvalError) return { error: approvalError.message }

  const installValues = {
    customer_name: franchise.business_name || franchise.owner_name || '미입력',
    customer_phone: franchise.phone || null,
    items: franchise.equipment_items ?? [],
    status: 'received',
    notes: franchise.memo || null,
    franchise_application_id: franchise.id,
    address: franchise.address || null,
    scheduled_date: franchise.install_date || null,
    created_by: approver.user.id,
    sort_order: Date.now(),
    updated_at: approvedAt,
  }
  const { error: installError } = existingInstall
    ? await admin.from('installations').update(installValues).eq('id', existingInstall.id)
    : await admin.from('installations').insert(installValues)
  if (installError) {
    await admin.from('franchise_transfer_approvals').update({ status: 'requested', approved_by: null, approved_by_name: null, approved_at: null }).eq('franchise_application_id', franchiseApplicationId)
    return { error: installError.message }
  }

  await admin.from('franchise_application_logs').insert({
    franchise_application_id: franchise.id,
    user_id: approver.user.id,
    from_status: franchise.status,
    to_status: existingInstall ? 'install_retransfer' : 'install_transfer',
  })

  return { error: null }
}
