import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import EquipmentSelectClient from './EquipmentSelectClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function EquipmentSelectPage({ params }: Props) {
  const { token } = await params
  // 고객은 로그인하지 않은 상태로 접근하므로 RLS를 우회하는 admin 클라이언트 사용
  // (equipment_select_token 자체가 보안 경계)
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('franchise_applications')
    .select('id, business_name, owner_name, equipment_select_token, selected_equipment, equipment_selected_at')
    .eq('equipment_select_token', token)
    .single()

  if (!row) notFound()

  return <EquipmentSelectClient row={row} />
}
