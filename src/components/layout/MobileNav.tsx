'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Wrench, MessageCircle, Bell } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import type { Role } from '@/types'

const NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/tickets', label: '작업', icon: FileText },
  { href: '/chat', label: '채팅', icon: MessageCircle },
  { href: '/notifications', label: '알림', icon: Bell },
]

const TECH_NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/installs/mine', label: '기사페이지', icon: Wrench },
  { href: '/chat', label: '채팅', icon: MessageCircle },
  { href: '/notifications', label: '알림', icon: Bell },
]

interface Props {
  role: Role
  unreadCount: number
}

export default function MobileNav({ role, unreadCount }: Props) {
  const pathname = usePathname()
  const items = role === 'tech' ? TECH_NAV : NAV

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex md:hidden z-50">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs gap-1 transition-colors ${
              active ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <item.icon size={20} />
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {item.label}
          </Link>
        )
      })}
      <div className="flex items-center px-2">
        <ThemeToggle compact />
      </div>
    </nav>
  )
}
