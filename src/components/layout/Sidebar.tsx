'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Store, Bell, LogOut, ChevronRight, Wrench, Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const ROLE_LABEL = { admin: '관리자', sales: '영업', cs: 'CS', tech: '기술지원' }
const ROLE_COLOR = { admin: 'bg-purple-100 text-purple-700', sales: 'bg-blue-100 text-blue-700', cs: 'bg-green-100 text-green-700', tech: 'bg-orange-100 text-orange-700' }

const NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/tickets', label: '작업 목록', icon: FileText, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/merchants', label: '가맹점', icon: Store, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/admin/users', label: '직원 관리', icon: Users, roles: ['admin'] },
]

interface Props {
  profile: Profile
  unreadCount: number
}

export default function Sidebar({ profile, unreadCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = NAV.filter(n => n.roles.includes(profile.role))

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* 로고 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">POS 전산</span>
        </div>
      </div>

      {/* 내 정보 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="font-medium text-gray-900 text-sm">{profile.name}</p>
        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[profile.role]}`}>
          {ROLE_LABEL[profile.role]}
        </span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon size={17} />
              {item.label}
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          )
        })}

        <Link
          href="/notifications"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            pathname === '/notifications'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Bell size={17} />
          알림
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
        >
          <LogOut size={17} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
