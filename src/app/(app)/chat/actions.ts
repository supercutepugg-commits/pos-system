'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function createGroupChatRoom(form: {
  name: string
  description: string
  memberIds: string[]
}) {
  const authError = await requireAdmin()
  if (authError) return { error: authError }

  const name = form.name.trim()
  const description = form.description.trim()
  if (!name) return { error: '팀 이름을 입력해주세요.' }
  if (name.length > 50) return { error: '팀 이름은 50자 이하로 입력해주세요.' }
  if (description.length > 200) return { error: '설명은 200자 이하로 입력해주세요.' }

  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const requestedMemberIds = [...new Set([user.id, ...form.memberIds])]
  const { data: validMembers, error: memberLookupError } = await admin
    .from('profiles')
    .select('id')
    .in('id', requestedMemberIds)
  if (memberLookupError) return { error: '팀 구성원을 확인하지 못했습니다.' }

  const roomId = randomUUID()
  const { error: roomError } = await admin.from('group_chat_rooms').insert({
    id: roomId,
    name,
    description: description || null,
  })
  if (roomError) {
    if (roomError.code === '23505') return { error: `이미 "${name}" 팀이 있습니다.` }
    return { error: '팀 생성 실패: ' + roomError.message }
  }

  const memberships = (validMembers ?? []).map((member: { id: string }) => ({
    room_id: roomId,
    user_id: member.id,
  }))
  const { error: membershipError } = await admin.from('group_chat_members').insert(memberships)
  if (membershipError) {
    await admin.from('group_chat_rooms').delete().eq('id', roomId)
    return { error: '팀 구성원 등록 실패: ' + membershipError.message }
  }

  revalidatePath('/chat')
  return { error: null }
}
