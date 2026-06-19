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
