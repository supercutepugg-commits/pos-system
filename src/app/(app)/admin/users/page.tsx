import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_LABEL_KR } from './constants'

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sales: 'bg-blue-100 text-blue-700',
  cs: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-orange-100 text-orange-700',
}

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('role')
    .order('name')

  const grouped: Record<string, typeof users> = {}
  users?.forEach(u => {
    if (!grouped[u.role]) grouped[u.role] = []
    grouped[u.role]!.push(u)
  })

  const roleOrder = ['admin', 'sales', 'cs', 'tech']
  const roleNames: Record<string, string> = {
    admin: '관리자', sales: '영업팀', cs: 'CS팀', tech: '기술지원팀'
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">직원 관리</h1>
        <p className="text-slate-500 text-sm mt-1">총 {users?.length ?? 0}명</p>
      </div>

      <div className="space-y-6">
        {roleOrder.map(role => {
          const members = grouped[role]
          if (!members?.length) return null
          return (
            <div key={role} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{roleNames[role]}</h2>
                <span className="text-sm text-slate-400">{members.length}명</span>
              </div>
              <div className="divide-y divide-slate-50">
                {members.map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 flex-shrink-0">
                      {u.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                      {u.phone && <p className="text-xs text-slate-400 mt-0.5">{u.phone}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_COLOR[u.role]}`}>
                      {roleNames[u.role]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
