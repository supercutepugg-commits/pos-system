"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

interface PopoverRenderProps {
  open: boolean;
  toggle: () => void;
  close: () => void;
  panelId: string;
}

export function Popover({ children }: { children: (context: PopoverRenderProps) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {children({
        open,
        toggle: () => setOpen((value) => !value),
        close: () => setOpen(false),
        panelId,
      })}
    </div>
  );
}

export function PopoverPanel({
  id,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { id: string }) {
  return (
    <div
      id={id}
      className={[
        "absolute right-0 top-[calc(100%+8px)] z-50 min-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-slate-900 shadow-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function PopoverItem({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={[
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
