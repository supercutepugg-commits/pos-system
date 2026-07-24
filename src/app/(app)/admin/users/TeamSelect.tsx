"use client";

import { useState, useTransition } from "react";
import { setUserTeam } from "./actions";
import { TEAM_LABEL_KR, TEAMS } from "./constants";
import { useToast } from "@/components/ui/Toast";

interface Props {
  userId: string;
  initialTeam: string;
}

export default function TeamSelect({ userId, initialTeam }: Props) {
  const [team, setTeam] = useState(initialTeam);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const previous = team;
    setTeam(next);
    startTransition(async () => {
      const { error } = await setUserTeam(userId, next);
      if (error) {
        toast.error("팀 변경 실패: " + error);
        setTeam(previous);
      }
    });
  }

  return (
    <select
      value={team}
      onChange={handleChange}
      disabled={isPending}
      aria-label="소속 팀"
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-50"
    >
      {TEAMS.map((item) => (
        <option key={item} value={item}>
          {TEAM_LABEL_KR[item]}
        </option>
      ))}
    </select>
  );
}
