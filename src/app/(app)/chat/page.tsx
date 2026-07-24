import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Users } from "lucide-react";
import type { Profile } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const ROLE_LABEL: Record<string, string> = {
  master: "마스터",
  admin: "관리자",
  sales: "영업",
  cs: "CS",
  tech: "기술지원",
  developer: "개발자",
};
const ROLE_COLOR: Record<string, string> = {
  master: "bg-red-100 text-red-700",
  admin: "bg-purple-100 text-purple-700",
  sales: "bg-blue-100 text-blue-700",
  cs: "bg-emerald-100 text-emerald-700",
  tech: "bg-orange-100 text-orange-700",
  developer: "bg-cyan-100 text-cyan-700",
};

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000000";

type ChatUser = Pick<Profile, "id" | "name" | "role">;
type DmRoom = { id: string; user1: ChatUser; user2: ChatUser };
type GroupRoom = { id: string; name: string; description: string | null };
type RecentMessage = { room_id: string; content: string; created_at: string };

interface Props {
  searchParams: Promise<{ error?: string }>;
}

function isUnread(lastMessageAt: string | undefined, lastReadAt: string | undefined) {
  return Boolean(lastMessageAt && (!lastReadAt || new Date(lastMessageAt) > new Date(lastReadAt)));
}

export default async function ChatListPage({ searchParams }: Props) {
  const { error: errorParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: users },
    { data: dmRoomData },
    { data: groupRoomData },
    { data: lastGlobalMsg },
    { data: reads },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("profiles").select("*").neq("id", user.id).order("name"),
    supabase
      .from("dm_rooms")
      .select(
        "*, user1:profiles!dm_rooms_user1_id_fkey(id,name,role), user2:profiles!dm_rooms_user2_id_fkey(id,name,role)",
      )
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase.from("group_chat_rooms").select("id, name, description").order("created_at"),
    supabase
      .from("messages")
      .select("content, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chat_room_reads")
      .select("room_type, room_id, last_read_at")
      .eq("user_id", user.id),
  ]);

  if (!profile) redirect("/login");

  const dmRooms = (dmRoomData ?? []) as unknown as DmRoom[];
  const groupRooms = (groupRoomData ?? []) as GroupRoom[];
  const dmRoomIds = dmRooms.map((room) => room.id);

  const [{ data: dmLastMessages }, groupLastMessageResults] = await Promise.all([
    dmRoomIds.length
      ? supabase
          .from("dm_messages")
          .select("room_id, created_at")
          .in("room_id", dmRoomIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { room_id: string; created_at: string }[] }),
    Promise.all(
      groupRooms.map(async (room) => {
        const { data } = await supabase
          .from("group_chat_messages")
          .select("room_id, content, created_at")
          .eq("room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data as RecentMessage | null;
      }),
    ),
  ]);

  const dmLastMessageAt = new Map<string, string>();
  for (const message of dmLastMessages ?? []) {
    if (!dmLastMessageAt.has(message.room_id))
      dmLastMessageAt.set(message.room_id, message.created_at);
  }

  const groupLastMessage = new Map<string, RecentMessage>();
  for (const message of groupLastMessageResults) {
    if (message) groupLastMessage.set(message.room_id, message);
  }

  const readsMap = new Map<string, string>();
  for (const read of reads ?? [])
    readsMap.set(`${read.room_type}:${read.room_id}`, read.last_read_at);

  const globalUnread = isUnread(
    lastGlobalMsg?.created_at,
    readsMap.get(`global:${GLOBAL_ROOM_ID}`),
  );
  const errorMessage =
    errorParam === "dm_room_create_failed"
      ? "대화방을 생성하지 못했습니다. 다시 시도해주세요."
      : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="bg-[#3e6d9c] px-5 py-4">
        <h1 className="text-lg font-bold text-white">채팅</h1>
      </div>

      {errorMessage && (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="bg-white">
        <p className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          기본 채팅방
        </p>
        <div className="divide-y divide-slate-100">
          <Link
            href="/chat/global"
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600">
              <Users size={22} className="text-white" />
              {globalUnread && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-slate-900 ${globalUnread ? "font-extrabold" : "font-bold"}`}>
                전체 채팅방
              </p>
              <p
                className="mt-0.5 truncate text-sm text-slate-500"
                title={lastGlobalMsg?.content ?? undefined}
              >
                {lastGlobalMsg?.content ?? "모든 직원이 참여하는 채팅방입니다."}
              </p>
            </div>
            {lastGlobalMsg && (
              <p className="shrink-0 text-xs text-slate-400">
                {format(new Date(lastGlobalMsg.created_at), "HH:mm", { locale: ko })}
              </p>
            )}
          </Link>

          {groupRooms.map((room) => {
            const lastMessage = groupLastMessage.get(room.id);
            const unread = isUnread(lastMessage?.created_at, readsMap.get(`group:${room.id}`));
            return (
              <Link
                key={room.id}
                href={`/chat/group/${room.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                  <Users size={22} className="text-white" />
                  {unread && (
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-slate-900 ${unread ? "font-extrabold" : "font-bold"}`}>
                    {room.name}
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm text-slate-500"
                    title={lastMessage?.content ?? undefined}
                  >
                    {lastMessage?.content ?? room.description ?? "팀 단체 채팅방"}
                  </p>
                </div>
                {lastMessage && (
                  <p className="shrink-0 text-xs text-slate-400">
                    {format(new Date(lastMessage.created_at), "HH:mm", { locale: ko })}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {dmRooms.length > 0 && (
        <section className="mt-4 bg-white">
          <p className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            최근 1:1 대화
          </p>
          <div className="divide-y divide-slate-100">
            {dmRooms.map((room) => {
              const other = room.user1.id === user.id ? room.user2 : room.user1;
              const lastMessageAt = dmLastMessageAt.get(room.id);
              const unread = isUnread(lastMessageAt, readsMap.get(`dm:${room.id}`));
              return (
                <Link
                  key={room.id}
                  href={`/chat/dm/${room.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-700">
                    {other.name[0]}
                    {unread && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-slate-900 ${unread ? "font-extrabold" : "font-bold"}`}>
                        {other.name}
                      </p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${ROLE_COLOR[other.role] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {ROLE_LABEL[other.role] ?? other.role}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">대화하기</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-4 bg-white">
        <p className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          직원 목록 — 탭하여 1:1 대화
        </p>
        <div className="divide-y divide-slate-50">
          {users?.map((other) => (
            <Link
              key={other.id}
              href={`/chat/new?to=${other.id}`}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
                {other.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{other.name}</p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${ROLE_COLOR[other.role] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {ROLE_LABEL[other.role] ?? other.role}
                </span>
              </div>
              <MessageCircle size={16} className="ml-auto text-slate-300" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
