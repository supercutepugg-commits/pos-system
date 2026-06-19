'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Store, Bell, LogOut, Wrench, Users, MessageCircle, ExternalLink, Package, PenLine, PhoneIncoming, CalendarDays
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const ROLE_LABEL = { admin: '관리자', sales: '영업', cs: 'CS', tech: '기술지원' }
const ROLE_COLOR = {
  admin: 'bg-purple-100 text-purple-700',
  sales: 'bg-blue-100 text-blue-700',
  cs: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-orange-100 text-orange-700'
}

const NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/tickets', label: '작업 목록', icon: FileText, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/merchants', label: '가맹점', icon: Store, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/chat', label: '채팅', icon: MessageCircle, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/admin/users', label: '직원 관리', icon: Users, roles: ['admin'] },
  { href: '/notifications', label: '알림', icon: Bell, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/contracts', label: '계약서 / 서명', icon: PenLine, roles: ['admin', 'cs'] },
  { href: '/installs', label: '설치 관리', icon: Package, roles: ['admin', 'tech'] },
  { href: '/calendar', label: '캘린더', icon: CalendarDays, roles: ['admin', 'sales', 'cs', 'tech'] },
  { href: '/inbound', label: '인입 내역', icon: PhoneIncoming, roles: ['admin', 'sales', 'cs', 'tech'] },
]

const EXTERNAL_LINKS: { href: string; label: string; icon: any; roles: string[] }[] = []

interface Props {
  profile: Profile
  unreadCount: number
  unreadDmCount?: number
}

export default function Sidebar({ profile, unreadCount, unreadDmCount = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = NAV.filter(n => n.roles.includes(profile.role))
  const externalItems = EXTERNAL_LINKS.filter(n => n.roles.includes(profile.role))

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shadow-sm">
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Wrench size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">POS 전산</p>
            <p className="text-xs text-slate-400">관리 시스템</p>
          </div>
        </div>
      </div>

      {/* 내 정보 */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="bg-slate-50 rounded-xl px-3 py-3">
          <p className="font-semibold text-slate-900 text-sm">{profile.name}</p>
          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[profile.role]}`}>
            {ROLE_LABEL[profile.role]}
          </span>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href ||
            (pathname.startsWith(item.href + '/') && !item.href.includes('?'))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon size={17} className={active ? 'text-white' : 'text-slate-400'} />
              {item.label}
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className={`ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {item.href === '/chat' && unreadDmCount > 0 && (
                <span className={`ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                  {unreadDmCount > 9 ? '9+' : unreadDmCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 외부 링크 */}
      {externalItems.length > 0 && (
        <div className="px-3 pb-2 border-t border-slate-100 pt-3">
          {externalItems.map(item => (
            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all mb-0.5">
              <item.icon size={17} className="text-slate-400" />
              {item.label}
              <ExternalLink size={12} className="ml-auto text-slate-300" />
            </a>
          ))}
        </div>
      )}

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
        >
          <LogOut size={17} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
