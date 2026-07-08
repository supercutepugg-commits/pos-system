'use client'

// 가맹접수 상태 변경 시 발생하는 부수효과(알림톡 발송, 설치작업 자동생성, 기술팀 자동이관)를
// franchise/FranchiseClient.tsx 와 transfers/TransfersClient.tsx 가 공통으로 사용하기 위한 모듈.
// 두 화면에서 같은 franchise_applications.status 값을 바꾸는데 부수효과가 다르면 안 되므로,
// 이 로직은 반드시 여기 한 곳에서만 구현하고 양쪽 클라이언트는 이 함수들을 호출만 한다.

import { createClient } from '@/lib/supabase/client'
import { APPLICANT_TYPE_LABEL, FRANCHISE_STATUS_LABEL } from '@/types'
import type { FranchiseApplication, FranchiseStatus } from '@/types'
import type { DocCase } from '@/lib/solapi'

export interface StatusEffectsToast {
  success: (msg: string) => void
  warning: (msg: string) => void
  error: (msg: string) => void
}

export function docCaseOf(ownerName?: string | null, businessName?: string | null): DocCase {
  if (ownerName && businessName) return 'both'
  if (businessName) return 'business_only'
  if (ownerName) return 'owner_only'
  return 'phone_only'
}

// franchise_applications.status 업데이트 시 함께 보낼 patch. doc_waiting으로 갈 때 서류 템플릿을 함께 갱신한다.
export function buildFranchiseStatusPatch(row: FranchiseApplication, status: FranchiseStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = { status }
  if (status === 'doc_waiting') patch.doc_template = APPLICANT_TYPE_LABEL[row.applicant_type]
  return patch
}

export async function notifyAndLogFranchiseStatus(
  franchiseId: string,
  logKey: string,
  payload: Record<string, unknown>,
  currentUserId: string,
  toast: StatusEffectsToast,
): Promise<void> {
  try {
    const res = await fetch('/api/franchise/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('가맹 알림톡 발송 실패:', json.error)
      toast.error(`알림톡 발송 실패: ${json.error ?? res.status} (상태는 변경됨)`)
      return
    }
    const supabase = createClient()
    await supabase.from('franchise_application_logs').insert({
      franchise_application_id: franchiseId,
      user_id: currentUserId,
      to_status: `alimtalk:${logKey}`,
    })
    toast.success('알림톡이 발송되었습니다.')
  } catch (err) {
    console.error('가맹 알림톡 발송 실패:', err)
    toast.error('알림톡 발송에 실패했습니다. 고객에게 직접 안내해주세요.')
  }
}

// 토스심사완료 -> 설치작업(merchants + tickets) 자동 생성.
// 티켓 생성이 실패하면 방금 만든 merchant가 고아로 남지 않도록 best-effort로 삭제한다.
export async function createLinkedInstallTicket(row: FranchiseApplication, toast: StatusEffectsToast): Promise<void> {
  if (!row.business_name || !row.owner_name || !row.phone || !row.address) {
    toast.warning('상호명·대표자명·연락처·주소가 모두 입력되지 않아 설치 작업을 자동으로 만들지 못했습니다. 직접 등록해주세요.')
    return
  }
  const supabase = createClient()
  const { data: merchant, error: merchantError } = await supabase.from('merchants').insert({
    business_name: row.business_name,
    owner_name: row.owner_name,
    business_number: row.business_number || null,
    phone: row.phone,
    address: row.address,
    address_detail: row.address_detail || null,
    pos_model: row.equipment_items?.length ? row.equipment_items.map(i => `${i.name} x${i.quantity}`).join(', ') : null,
    sales_id: row.sales_id || null,
    memo: row.memo || null,
  }).select('id').single()

  if (merchantError || !merchant) {
    toast.error('가맹점 자동 등록 실패: ' + merchantError?.message)
    return
  }

  const { error: ticketError } = await supabase.from('tickets').insert({
    merchant_id: merchant.id,
    title: row.title || `${row.business_name} 가맹 설치`,
    type: 'install',
    status: 'tech_pending',
    sales_id: row.sales_id || null,
    cs_id: row.cs_id || null,
    memo: row.memo || null,
    reception_channel: row.reception_channel || null,
    open_date: row.open_date || null,
    install_date: row.install_date || null,
  })

  if (ticketError) {
    const { error: cleanupError } = await supabase.from('merchants').delete().eq('id', merchant.id)
    if (cleanupError) console.error('고아 가맹점 정리 실패:', cleanupError.message)
    toast.error('설치 작업 생성 실패로 방금 등록한 가맹점도 함께 취소했습니다: ' + ticketError.message)
    return
  }
}

// 카드가맹완료 -> 설치관리에 이관, 기술팀 전원에게 알림.
// existing이 'rejected' 상태면 재이관(같은 설치건 재사용), 없으면 새로 생성.
export async function autoTransferToTech(
  row: FranchiseApplication,
  currentUserId: string,
  existing: { id: string; status: string } | undefined,
): Promise<{ id: string; status: string } | null> {
  if (existing && existing.status !== 'rejected') return null // 이미 이관됨
  const supabase = createClient()
  let installId: string
  if (existing?.status === 'rejected') {
    const { error } = await supabase.from('installations').update({ status: 'received', updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) return null
    installId = existing.id
  } else {
    const { data, error } = await supabase.from('installations').insert({
      customer_name: row.business_name || row.owner_name || '미입력',
      customer_phone: row.phone || null,
      items: row.equipment_items ?? [],
      status: 'received',
      notes: row.memo || null,
      franchise_application_id: row.id,
      address: row.address || null,
      scheduled_date: row.install_date || null,
      created_by: currentUserId,
    }).select('id').single()
    if (error) return null
    installId = data.id
  }
  const { data: techUsers } = await supabase.from('profiles').select('id').eq('role', 'tech')
  if (techUsers?.length) {
    const { error: notifyError } = await supabase.from('notifications').insert(techUsers.map(t => ({
      user_id: t.id,
      franchise_application_id: row.id,
      type: 'install_transfer',
      title: `[${row.business_name || row.owner_name || '미입력'}] 설치 자동 이관`,
      body: '카드가맹완료로 설치건이 자동 생성되었습니다.',
    })))
    if (notifyError) console.error('기술팀 알림 발송 실패:', notifyError.message)
  }
  return { id: installId, status: 'received' }
}

interface ApplyStatusSideEffectsParams {
  row: FranchiseApplication
  status: FranchiseStatus
  sendNotify: boolean
  docCase?: DocCase
  currentUserId: string
  toast: StatusEffectsToast
  existingLinkedInstall?: { id: string; status: string }
}

// FranchiseClient.updateStatus 의 상태변경 부수효과(알림톡 / 설치작업 자동생성 / 기술팀 자동이관)를
// 그대로 재현한다. status/patch DB 업데이트와 franchise_application_logs insert는 호출부에서
// (각자의 로컬 상태 갱신과 함께) 먼저 수행한 뒤, 성공 시 이 함수를 호출한다.
export async function applyFranchiseStatusSideEffects(params: ApplyStatusSideEffectsParams): Promise<{ linkedInstall?: { id: string; status: string } }> {
  const { row, status, sendNotify, docCase, currentUserId, toast, existingLinkedInstall } = params

  if (sendNotify) {
    if (status === 'doc_waiting') {
      await notifyAndLogFranchiseStatus(row.id, 'doc_waiting', { type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status: 'doc_waiting' }, currentUserId, toast)
      await notifyAndLogFranchiseStatus(row.id, 'doc_request', { type: 'doc_request', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, applicantType: row.applicant_type, docCase }, currentUserId, toast)
    } else if (status === 'card_internet_apply_done') {
      await notifyAndLogFranchiseStatus(row.id, 'card_apply_done', { type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status: 'card_apply_done' }, currentUserId, toast)
    } else {
      await notifyAndLogFranchiseStatus(row.id, status, { type: 'status_update', phone: row.phone, ownerName: row.owner_name, businessName: row.business_name, status }, currentUserId, toast)
    }
  }

  if (status === 'toss_review_done') await createLinkedInstallTicket(row, toast)

  if (status === 'card_done') {
    const linked = await autoTransferToTech(row, currentUserId, existingLinkedInstall)
    if (linked) return { linkedInstall: linked }
  }

  return {}
}

// 상태변경 확인창에 쓰는 안내 문구 + 알림 발송 가능 여부.
// FranchiseClient.handleStatusChange 의 문구 로직과 동일하게 유지한다.
export function franchiseStatusChangeConfirm(row: FranchiseApplication, newStatus: FranchiseStatus): { msg: string; canNotify: boolean } {
  const canNotify = newStatus !== 'completed' && !!row.phone
  const confirmMsg = newStatus === 'completed'
    ? `'완료'로 상태만 변경됩니다. (고객 안내 메시지는 발송되지 않습니다)`
    : newStatus === 'doc_waiting'
      ? `'${APPLICANT_TYPE_LABEL[row.applicant_type]}' 서류 안내 메시지가 고객에게 발송됩니다. 진행하시겠습니까?`
      : newStatus === 'toss_review_done'
        ? `토스심사완료로 변경하면 고객에게 메시지가 발송되고, 입력된 정보로 설치 작업이 자동 생성됩니다.`
        : `'${FRANCHISE_STATUS_LABEL[newStatus]}'(으)로 변경하면 고객에게 메시지가 발송됩니다.`
  return {
    msg: newStatus === 'completed' ? confirmMsg : canNotify ? confirmMsg : '연락처가 없어 메시지 발송 없이 상태만 변경됩니다.',
    canNotify,
  }
}
