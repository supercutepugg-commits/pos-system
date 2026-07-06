'use client'

import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { FRANCHISE_STATUS_LABEL, APPLICANT_TYPE_LABEL, type FranchiseStatus, type ApplicantType } from '@/types'
import { useState } from 'react'

export default function ExcelDownloadButton() {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const supabase = createClient()
      const [{ data: franchiseRows }, { data: installRows }, { data: ticketRows }, { data: merchantRows }] = await Promise.all([
        supabase.from('franchise_applications')
          .select('*, sales:profiles!franchise_applications_sales_id_fkey(name), cs:profiles!franchise_applications_cs_id_fkey(name)')
          .order('created_at', { ascending: false }),
        supabase.from('installations')
          .select('*, assignee:profiles!installations_assigned_to_fkey(name)')
          .order('created_at', { ascending: false }),
        supabase.from('tickets')
          .select('*, merchant:merchants(business_name,phone), tech:profiles!tickets_tech_id_fkey(name)')
          .order('created_at', { ascending: false }),
        supabase.from('merchants')
          .select('*, sales:profiles!merchants_sales_id_fkey(name)')
          .order('created_at', { ascending: false }),
      ])

      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // 시트1: 가맹접수
      const franchiseData = (franchiseRows ?? []).map((r: any) => ({
        상호명: r.business_name ?? '',
        대표자: r.owner_name ?? '',
        연락처: r.phone ?? '',
        사업자번호: r.business_number ?? '',
        사업자유형: APPLICANT_TYPE_LABEL[r.applicant_type as ApplicantType] ?? r.applicant_type,
        접수채널: r.reception_channel ?? '',
        상태: FRANCHISE_STATUS_LABEL[r.status as FranchiseStatus] ?? r.status,
        담당영업: r.sales?.name ?? '',
        담당CS: r.cs?.name ?? '',
        주소: r.address ?? '',
        인터넷: r.internet ?? '',
        VAN사: r.van_company ?? '',
        오픈예정일: r.open_date ?? '',
        설치발송일: r.install_date ?? '',
        비고: r.memo ?? '',
        등록일: r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
        최종수정일: r.updated_at ? format(new Date(r.updated_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(franchiseData), '가맹접수')

      // 시트2: 설치관리
      const STATUS_KO: Record<string, string> = { received: '접수', preparing: '제품준비', scheduled: '일정확정', in_transit: '이동중', completed: '설치완료', rejected: '반려' }
      const installData = (installRows ?? []).map((i: any) => ({
        고객명: i.customer_name ?? '',
        전화번호: i.customer_phone ?? '',
        제품: (i.items ?? []).map((it: any) => `${it.name} x${it.quantity}`).join(', '),
        상태: STATUS_KO[i.status] ?? i.status,
        담당기사: i.assignee?.name ?? '',
        주소: i.address ?? '',
        비고: i.notes ?? '',
        등록일: i.created_at ? format(new Date(i.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(installData), '설치관리')

      // 시트3: AS티켓
      const ticketData = (ticketRows ?? []).map((t: any) => ({
        제목: t.title ?? '',
        유형: t.type ?? '',
        상태: t.status ?? '',
        우선순위: t.priority ?? '',
        가맹점: t.merchant?.business_name ?? '',
        담당기사: t.tech?.name ?? '',
        예약일: t.scheduled_at ? format(new Date(t.scheduled_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
        등록일: t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ticketData), 'AS티켓')

      // 시트4: 가맹점
      const merchantData = (merchantRows ?? []).map((m: any) => ({
        상호명: m.business_name ?? '',
        대표자: m.owner_name ?? '',
        전화번호: m.phone ?? '',
        주소: m.address ?? '',
        POS모델: m.pos_model ?? '',
        담당영업: m.sales?.name ?? '',
        메모: m.memo ?? '',
        등록일: m.created_at ? format(new Date(m.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(merchantData), '가맹점')

      XLSX.writeFile(wb, `전체현황_${format(new Date(), 'yyyyMMdd_HHmm', { locale: ko })}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
    >
      <Download size={15} />
      {loading ? '다운로드 중...' : '전체 데이터 엑셀'}
    </button>
  )
}
