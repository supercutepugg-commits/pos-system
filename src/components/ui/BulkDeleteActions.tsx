import { ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  count: number;
  deleting: boolean;
  onDelete: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function BulkDeleteActions({
  count,
  deleting,
  onDelete,
  onCancel,
  children,
}: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-slate-200 shadow-lg rounded-xl px-5 py-3">
      <span className="text-sm font-semibold text-blue-700">{count}건 선택됨</span>
      {children}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Trash2 size={14} />
        {deleting ? "삭제 중..." : "선택 삭제"}
      </button>
      <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
        취소
      </button>
    </div>
  );
}
