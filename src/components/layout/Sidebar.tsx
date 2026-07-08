'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Store, Bell, LogOut, Wrench, Users, MessageCircle, ExternalLink, Package, PenLine,
  CalendarDays, ClipboardList, Briefcase, Headset, HardHat, ChevronDown, BookUser, Wifi, RefreshCw, FileText,
  Network, FileEdit, Hash, Images,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/types'

const ROLE_LABEL = { admin: '관리자', sales: '영업', cs: 'CS', tech: '기술지원' }
const ROLE_COLOR = {
  admin: 'bg-purple-100 text-purple-700',
  sales: 'bg-blue-100 text-blue-700',
  cs: 'bg-emerald-100 text-emerald-700',
  tech: 'bg-orange-100 text-orange-700'
}

interface NavItem {
  href: string
  label: string
  icon: any
}

// 모든 역할이 공통으로 쓰는 항목 (역할 폴더 위에 따로 표시) — 중요도/사용빈도 높은 순
const COMMON_NAV: NavItem[] = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/calendar', label: '캘린더', icon: CalendarDays },
  { href: '/merchants', label: '가맹점', icon: Store },
  { href: '/chat', label: '채팅', icon: MessageCircle },
  { href: '/contracts', label: '계약서 / 서명', icon: PenLine },
  { href: '/slack', label: 'Slack', icon: Hash },
]

// 역할별 폴더 — admin은 전부 보임
const ROLE_FOLDERS: { key: Role; label: string; icon: any; items: NavItem[] }[] = [
  {
    key: 'cs',
    label: 'CS',
    icon: Headset,
    items: [
      { href: '/franchise', label: '가맹 접수', icon: ClipboardList },
      { href: '/changes', label: '변경 관리', icon: FileEdit },
      { href: '/woo', label: '우국상 관리', icon: BookUser },
      { href: '/internet', label: '인터넷 관리', icon: Wifi },
    ],
  },
  {
    key: 'tech',
    label: '기술지원',
    icon: HardHat,
    items: [
      { href: '/installs', label: '설치 관리', icon: Package },
      { href: '/installs/mine', label: '기사 페이지', icon: HardHat },
      { href: '/installs/photos', label: '완료사진', icon: Images },
      { href: '/external-techs', label: '외부 기사 관리', icon: Users },
      { href: '/inventory', label: '재고 실사', icon: ClipboardList },
      { href: '/transfers', label: '전환건', icon: RefreshCw },
      { href: '/blueprints', label: '설계도', icon: Network },
    ],
  },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/users', label: '직원 관리', icon: Users },
]

const BOTTOM_NAV: NavItem[] = [
  { href: '/paper-orders', label: '용지 요청', icon: FileText },
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

  // 폴더는 역할 상관없이 전부 보이고, 실제 접근 권한은 각 페이지에서 따로 체크함
  const visibleFolders = ROLE_FOLDERS
  const storageKey = `sidebar_open_folders_${profile.id}`

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch {}
    return new Set(visibleFolders.filter(f => f.key === profile.role || profile.role === 'admin').map(f => f.key))
  })

  function toggleFolder(key: string) {
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const externalItems = EXTERNAL_LINKS.filter(n => n.roles.includes(profile.role))

  // 같은 href가 여러 폴더에 들어있을 때, 마지막으로 클릭한 폴더 쪽만 강조하기 위한 힌트
  const [activeFolderHint, setActiveFolderHint] = useState<Role | null>(null)

  const allHrefs = [
    ...COMMON_NAV.map(n => n.href),
    ...ROLE_FOLDERS.flatMap(f => f.items.map(i => i.href)),
    ...ADMIN_NAV.map(n => n.href),
    ...BOTTOM_NAV.map(n => n.href),
  ]

  // pathname과 매칭되는 href들 중 가장 구체적인(긴) 것만 활성화 처리
  // (예: /installs/mine 방문 시 /installs 까지 같이 강조되는 것 방지)
  function isActive(href: string) {
    if (href.includes('?')) return false
    if (pathname === href) return true
    if (!pathname.startsWith(href + '/')) return false
    const moreSpecific = allHrefs.some(
      other => other !== href && other.startsWith(href + '/') && (pathname === other || pathname.startsWith(other + '/'))
    )
    return !moreSpecific
  }

  function foldersContaining(href: string) {
    return visibleFolders.filter(f => f.items.some(i => i.href === href)).map(f => f.key)
  }

  function isHighlighted(href: string, folderKey?: Role) {
    if (!isActive(href)) return false
    if (!folderKey) return true
    const owners = foldersContaining(href)
    if (owners.length <= 1) return true
    const winner = activeFolderHint && owners.includes(activeFolderHint) ? activeFolderHint : (owners.includes(profile.role) ? profile.role : owners[0])
    return winner === folderKey
  }

  function NavLink({ item, indent, folderKey }: { item: NavItem; indent?: boolean; folderKey?: Role }) {
    const active = isHighlighted(item.href, folderKey)
    return (
      <Link key={item.href} href={item.href}
        onClick={() => { if (folderKey) setActiveFolderHint(folderKey) }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${indent ? 'ml-3' : ''} ${
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
  }

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
        {COMMON_NAV.map(item => <NavLink key={item.href} item={item} />)}

        {visibleFolders.length > 0 && <div className="my-2 border-t border-slate-100" />}

        {visibleFolders.map(folder => {
          const open = openFolders.has(folder.key)
          return (
            <div key={folder.key} className="mb-0.5">
              <button
                onClick={() => toggleFolder(folder.key)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all w-full"
              >
                <folder.icon size={17} className="text-slate-400" />
                {folder.label}
                <ChevronDown size={15} className={`ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="mt-0.5">
                  {folder.items.map(item => <NavLink key={item.href} item={item} indent folderKey={folder.key} />)}
                </div>
              )}
            </div>
          )
        })}

        <div className="my-2 border-t border-slate-100" />
        {BOTTOM_NAV.map(item => <NavLink key={item.href} item={item} />)}

        {profile.role === 'admin' && (
          <>
            {ADMIN_NAV.map(item => <NavLink key={item.href} item={item} />)}
          </>
        )}
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

      {/* 새로고침 / 로그아웃 */}
      <div className="px-3 py-4 border-t border-slate-100 flex flex-col gap-1">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all w-full"
        >
          <RefreshCw size={17} />
          하드 새로고침
        </button>
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
