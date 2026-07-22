'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, LogOut, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'
import { breadcrumbForPath } from './navItems'
import { Popover, PopoverItem, PopoverPanel } from '@/components/ui/Popover'
import type { Profile, Role } from '@/types'

const ROLE_LABEL: Record<Role, string> = {
  master: '마스터',
  admin: '관리자',
  sales: '영업',
  cs: 'CS',
  tech: '기술지원',
  developer: '개발자',
}

export default function AppHeader({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const breadcrumb = breadcrumbForPath(pathname)
  const initial = profile.name.trim().slice(0, 1) || 'P'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        {breadcrumb.map((label, index) => (
          <span key={`${label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <span>/</span>}
            <span
              className={
                index === breadcrumb.length - 1 ? 'font-semibold text-slate-900' : undefined
              }
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <Popover>
        {({ open, toggle, close, panelId }) => (
          <>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50"
            >
              <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-200 text-sm font-bold text-blue-700">
                {initial}
              </div>
              <div className="text-left leading-tight">
                <div className="text-sm font-semibold text-slate-900">{profile.name}</div>
                <div className="text-[11px] text-slate-400">{ROLE_LABEL[profile.role]}</div>
              </div>
              <ChevronDown className="size-3.5 text-slate-400" />
            </button>

            {open && (
              <PopoverPanel id={panelId} role="menu">
                <div className="border-b border-slate-200 px-3.5 py-3">
                  <div className="text-sm font-semibold text-slate-900">{profile.name}</div>
                  <div className="text-xs text-slate-400">{ROLE_LABEL[profile.role]}</div>
                </div>
                <div className="px-3.5 py-3">
                  <div className="mb-2 text-xs font-medium text-slate-400">테마</div>
                  <ThemeToggle />
                </div>
                <div className="my-1 border-t border-slate-200" />
                <PopoverItem
                  onClick={() => {
                    close()
                    window.location.reload()
                  }}
                >
                  <RefreshCw className="size-4" />
                  하드 새로고침
                </PopoverItem>
                <PopoverItem
                  onClick={() => {
                    close()
                    void handleLogout()
                  }}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="size-4" />
                  로그아웃
                </PopoverItem>
              </PopoverPanel>
            )}
          </>
        )}
      </Popover>
    </header>
  )
}
