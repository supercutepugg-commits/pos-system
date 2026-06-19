'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Store, Bell } from 'lucide-react'
import type { Role } from '@/types'

const NAV = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/tickets', label: '작업', icon: FileText },
  { href: '/merchants', label: '가맹점', icon: Store },
  { href: '/notifications', label: '알림', icon: Bell },
]

interface Props {
  role: Role
  unreadCount: number
}

export default function MobileNav({ role: _role, unreadCount }: Props) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
      {NAV.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs gap-1 transition-colors ${
              active ? 'text-blue-600' : 'text-gray-500'
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
    </nav>
  )
}
