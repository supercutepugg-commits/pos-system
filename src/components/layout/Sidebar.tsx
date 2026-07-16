"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import LogoMark from "./LogoMark";
import {
  COMMON_NAV,
  ROLE_FOLDERS,
  ADMIN_NAV,
  MASTER_NAV,
  BOTTOM_NAV,
  type NavItem,
} from "./nav-items";
import type { Profile, Role } from "@/types";

const EXTERNAL_LINKS: {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}[] = [];

interface Props {
  profile: Profile;
  unreadCount: number;
  unreadDmCount?: number;
}

export default function Sidebar({
  profile,
  unreadCount,
  unreadDmCount = 0,
}: Props) {
  const pathname = usePathname();

  const visibleFolders = ROLE_FOLDERS;
  const storageKey = `sidebar_open_folders_${profile.id}`;

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    return new Set(
      visibleFolders
        .filter(
          (f) =>
            f.key === profile.role ||
            profile.role === "admin" ||
            profile.role === "master",
        )
        .map((f) => f.key),
    );
  });

  function toggleFolder(key: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const externalItems = EXTERNAL_LINKS.filter((n) =>
    n.roles.includes(profile.role),
  );

  const [activeFolderHint, setActiveFolderHint] = useState<Role | null>(null);

  const allHrefs = [
    ...COMMON_NAV.map((n) => n.href),
    ...ROLE_FOLDERS.flatMap((f) => f.items.map((i) => i.href)),
    ...ADMIN_NAV.map((n) => n.href),
    ...MASTER_NAV.map((n) => n.href),
    ...BOTTOM_NAV.map((n) => n.href),
  ];

  function isActive(href: string) {
    if (href.includes("?")) return false;
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    const moreSpecific = allHrefs.some(
      (other) =>
        other !== href &&
        other.startsWith(href + "/") &&
        (pathname === other || pathname.startsWith(other + "/")),
    );
    return !moreSpecific;
  }

  function foldersContaining(href: string) {
    return visibleFolders
      .filter((f) => f.items.some((i) => i.href === href))
      .map((f) => f.key);
  }

  function isHighlighted(href: string, folderKey?: Role) {
    if (!isActive(href)) return false;
    if (!folderKey) return true;
    const owners = foldersContaining(href);
    if (owners.length <= 1) return true;
    const winner =
      activeFolderHint && owners.includes(activeFolderHint)
        ? activeFolderHint
        : owners.includes(profile.role)
          ? profile.role
          : owners[0];
    return winner === folderKey;
  }

  function NavLink({
    item,
    indent,
    folderKey,
  }: {
    item: NavItem;
    indent?: boolean;
    folderKey?: Role;
  }) {
    const active = isHighlighted(item.href, folderKey);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={() => {
          if (folderKey) setActiveFolderHint(folderKey);
        }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${collapsed ? "justify-center" : ""} ${indent && !collapsed ? "ml-3" : ""} ${
          active
            ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <item.icon
          size={17}
          className={`shrink-0 ${active ? "text-white" : "text-slate-400"}`}
        />
        {!collapsed && item.label}
        {!collapsed && item.href === "/notifications" && unreadCount > 0 && (
          <span
            className={`ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? "bg-white text-blue-600" : "bg-red-500 text-white"}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {!collapsed && item.href === "/chat" && unreadDmCount > 0 && (
          <span
            className={`ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? "bg-white text-blue-600" : "bg-red-500 text-white"}`}
          >
            {unreadDmCount > 9 ? "9+" : unreadDmCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shadow-sm transition-[width] duration-150 ${collapsed ? "w-[70px]" : "w-64"}`}
    >
      {}
      <div
        className={`px-4 py-5 border-b border-slate-100 flex items-center ${collapsed ? "justify-center" : "justify-between px-6"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <LogoMark className="size-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm leading-tight truncate">
                POS 전산
              </p>
              <p className="text-xs text-slate-400">관리 시스템</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="메뉴 접기"
            className="shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="메뉴 펼치기"
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center h-8 border-b border-slate-100"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {COMMON_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {visibleFolders.length > 0 && (
          <div className="my-2 border-t border-slate-100" />
        )}

        {visibleFolders.map((folder) => {
          const open = collapsed || openFolders.has(folder.key);
          return (
            <div key={folder.key} className="mb-0.5">
              {!collapsed && (
                <button
                  onClick={() => toggleFolder(folder.key)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all w-full"
                >
                  <folder.icon size={17} className="text-slate-400" />
                  {folder.label}
                  <ChevronDown
                    size={15}
                    className={`ml-auto text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
              )}
              {open && (
                <div className={collapsed ? "" : "mt-0.5"}>
                  {folder.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      indent
                      folderKey={folder.key}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="my-2 border-t border-slate-100" />
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {(profile.role === "admin" || profile.role === "master") && (
          <>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}

        {profile.role === "master" && (
          <>
            {MASTER_NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {}
      {!collapsed && externalItems.length > 0 && (
        <div className="px-3 pb-2 border-t border-slate-100 pt-3">
          {externalItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all mb-0.5"
            >
              <item.icon size={17} className="text-slate-400" />
              {item.label}
              <ExternalLink size={12} className="ml-auto text-slate-300" />
            </a>
          ))}
        </div>
      )}

    </aside>
  );
}
