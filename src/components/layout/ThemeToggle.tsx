"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Sparkles } from "lucide-react";

type Theme = "light" | "dark" | "pink";

const THEMES: { key: Theme; label: string; icon: any }[] = [
  { key: "light", label: "라이트", icon: Sun },
  { key: "dark", label: "다크", icon: Moon },
  { key: "pink", label: "핑크", icon: Sparkles },
];

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let saved: Theme = "light";
    try {
      saved = (localStorage.getItem("theme") as Theme | null) ?? "light";
    } catch {}
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function select(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return (
    <div
      className={`flex items-center gap-1 bg-slate-100 rounded-xl p-1 ${compact ? "" : "w-full"}`}
    >
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => select(t.key)}
          title={t.label}
          className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
            compact ? "w-8 h-8" : "flex-1 py-2"
          } ${
            theme === t.key
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <t.icon size={14} />
          {!compact && t.label}
        </button>
      ))}
    </div>
  );
}
