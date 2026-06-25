export type Role = 'admin' | 'sales' | 'cs' | 'tech'

export type TicketStatus =
  | 'sales'
  | 'cs_pending'
  | 'cs_progress'
  | 'scheduled'
  | 'tech_pending'
  | 'in_progress'
  | 'done'
  | 'canceled'

export type TicketType = 'install' | 'as' | 'consult' | 'other'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export type FranchiseStatus = 'info_input' | 'doc_waiting' | 'doc_incomplete' | 'doc_complete' | 'franchise_done'
export type ApplicantType = 'corporate' | 'individual' | 'existing'

export interface Profile {
  id: string
  name: string
  phone?: string
  role: Role
  created_at: string
}

export interface Merchant {
  id: string
  business_name: string
  owner_name: string
  business_number?: string
  phone: string
  address: string
  address_detail?: string
  pos_model?: string
  service_type?: string
  memo?: string
  sales_id?: string
  created_at: string
  updated_at: string
  sales?: Profile
}

export interface Ticket {
  id: string
  merchant_id: string
  title: string
  type: TicketType
  status: TicketStatus
  priority: Priority
  scheduled_at?: string
  sales_id?: string
  cs_id?: string
  tech_id?: string
  memo?: string
  // 영업/CS 추가 필드
  business_type?: string
  reception_channel?: string
  progress_note?: string
  document_status?: string
  open_date?: string
  install_date?: string
  internet?: string
  product?: string
  card_apply_date?: string
  van_company?: string
  baemin_apply?: boolean
  simple_payment?: string
  created_at: string
  updated_at: string
  merchant?: Merchant
  sales?: Profile
  cs?: Profile
  tech?: Profile
}

export interface TicketLog {
  id: string
  ticket_id: string
  user_id?: string
  from_status?: string
  to_status?: string
  message?: string
  created_at: string
  user?: Profile
}

export interface ContactLog {
  id: string
  ticket_id?: string
  merchant_id?: string
  user_id?: string
  method?: 'call' | 'kakao' | 'visit' | 'other'
  content: string
  created_at: string
  user?: Profile
}

export interface FranchiseApplication {
  id: string
  business_name: string
  owner_name: string
  phone: string
  sales_id?: string
  cs_id?: string
  status: FranchiseStatus
  applicant_type: ApplicantType
  doc_template?: string
  memo?: string
  created_at: string
  updated_at: string
  sales?: Profile
  cs?: Profile
}

export interface Notification {
  id: string
  user_id: string
  ticket_id?: string
  type: string
  title: string
  body?: string
  is_read: boolean
  created_at: string
  ticket?: Ticket
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  sales: '영업 접수',
  cs_pending: 'CS 대기',
  cs_progress: 'CS 진행중',
  scheduled: '일정 확정',
  tech_pending: '배정완료',
  in_progress: '작업중',
  done: '완료',
  canceled: '취소',
}

export const STATUS_COLOR: Record<TicketStatus, string> = {
  sales: 'bg-gray-100 text-gray-700',
  cs_pending: 'bg-yellow-100 text-yellow-700',
  cs_progress: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  tech_pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-700',
}

export const TYPE_LABEL: Record<TicketType, string> = {
  install: '신규 설치',
  as: 'A/S',
  consult: '상담',
  other: '기타',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급',
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export const FRANCHISE_STATUS_LABEL: Record<FranchiseStatus, string> = {
  info_input: '정보 입력',
  doc_waiting: '서류 대기',
  doc_incomplete: '서류 미비',
  doc_complete: '접수 완료',
  franchise_done: '가맹 완료',
}

export const FRANCHISE_STATUS_COLOR: Record<FranchiseStatus, string> = {
  info_input: 'bg-gray-100 text-gray-700',
  doc_waiting: 'bg-yellow-100 text-yellow-700',
  doc_incomplete: 'bg-red-100 text-red-700',
  doc_complete: 'bg-blue-100 text-blue-700',
  franchise_done: 'bg-green-100 text-green-700',
}

export const APPLICANT_TYPE_LABEL: Record<ApplicantType, string> = {
  corporate: '신규 법인사업자',
  individual: '신규 개인사업자',
  existing: '기가맹',
}
