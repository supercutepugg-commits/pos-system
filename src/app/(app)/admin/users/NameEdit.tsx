"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { setUserName } from "./actions";
import { useToast } from "@/components/ui/Toast";

interface Props {
  userId: string;
  initialName: string;
}

export default function NameEdit({ userId, initialName }: Props) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    startTransition(async () => {
      const { error } = await setUserName(userId, next);
      if (error) {
        toast.error("이름 변경 실패: " + error);
        setDraft(name);
        return;
      }
      setName(next);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="flex items-center gap-1 group text-left"
        title="이름 변경"
      >
        <span className="font-semibold text-slate-900 text-sm">{name}</span>
        <Pencil size={11} className="text-slate-300 group-hover:text-slate-500" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(name);
          }
        }}
        disabled={isPending}
        className="text-sm font-semibold border border-blue-300 rounded-lg px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="text-emerald-500 hover:text-emerald-600 disabled:opacity-50"
      >
        <Check size={14} />
      </button>
      <button
        onClick={() => {
          setEditing(false);
          setDraft(name);
        }}
        disabled={isPending}
        className="text-slate-300 hover:text-slate-500 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}
