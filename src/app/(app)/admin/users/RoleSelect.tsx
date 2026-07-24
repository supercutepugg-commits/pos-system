"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "./actions";
import { ROLE_LABEL_KR } from "./constants";
import { useToast } from "@/components/ui/Toast";

const ROLES = ["master", "admin", "sales", "cs", "tech", "developer"];

interface Props {
  userId: string;
  initialRole: string;
}

export default function RoleSelect({ userId, initialRole }: Props) {
  const [role, setRole] = useState(initialRole);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = role;
    setRole(next);
    startTransition(async () => {
      const { error } = await setUserRole(userId, next);
      if (error) {
        toast.error("역할 변경 실패: " + error);
        setRole(prev);
      }
    });
  }

  return (
    <select
      value={role}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL_KR[r]}
        </option>
      ))}
    </select>
  );
}
