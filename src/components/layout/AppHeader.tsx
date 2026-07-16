"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";
import { ALL_NAV_ENTRIES } from "./nav-items";
import type { Profile } from "@/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  master: "마스터",
  admin: "관리자",
  sales: "영업",
  cs: "CS",
  tech: "기술지원",
};

function useBreadcrumb() {
  const pathname = usePathname();
  const entry = ALL_NAV_ENTRIES.find((item) => item.href === pathname);
  if (!entry) return [];
  return entry.folderLabel ? [entry.folderLabel, entry.label] : [entry.label];
}

interface Props {
  profile: Profile;
  unreadCount: number;
}

export default function AppHeader({ profile, unreadCount }: Props) {
  const router = useRouter();
  const breadcrumb = useBreadcrumb();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = profile.name?.trim().slice(0, 1) || "U";

  return (
    <header className="h-[58px] shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        {breadcrumb.map((label, idx) => (
          <span key={label} className="flex items-center gap-1.5">
            {idx > 0 && <span>/</span>}
            <span
              className={
                idx === breadcrumb.length - 1
                  ? "text-slate-900 font-semibold"
                  : undefined
              }
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="알림"
          className="relative flex items-center justify-center size-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="w-px h-5.5 bg-slate-200 mx-1" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2"
          >
            <div className="size-[34px] shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
              {initial}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">
                {profile.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {ROLE_LABEL[profile.role]}
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <div className="px-3.5 py-3 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">
                    {profile.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {ROLE_LABEL[profile.role]}
                  </div>
                </div>
                <div className="px-3.5 py-3">
                  <div className="text-xs text-slate-400 font-medium mb-2">
                    테마
                  </div>
                  <ThemeToggle />
                </div>
                <div className="border-t border-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  <RefreshCw size={16} />
                  하드 새로고침
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
