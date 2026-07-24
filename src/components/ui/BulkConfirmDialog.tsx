interface Item {
  id: string;
  label: string;
  detail?: string;
}

interface Props {
  open: boolean;
  title: string;
  items: Item[];
  confirmText?: string;
  confirmColor?: "red" | "blue";
  busy?: boolean;
  subtitle?: string;
  confirmQuestion?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BulkConfirmDialog({
  open,
  title,
  items,
  confirmText = "변경",
  confirmColor = "blue",
  busy = false,
  subtitle,
  confirmQuestion = "정말 변경하시겠습니까?",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmClass =
    confirmColor === "red" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 flex flex-col max-h-[80vh]">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {subtitle ?? `아래 ${items.length}건에 적용됩니다.`}
          </p>
        </div>
        <div className="overflow-y-auto px-5 flex-1 border-t border-b border-slate-100 py-2">
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="py-2 text-sm text-slate-700 flex items-center justify-between gap-3"
              >
                <span className="font-medium">{item.label}</span>
                {item.detail && <span className="text-slate-700 text-right">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">{confirmQuestion}</p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`text-sm font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors ${confirmClass}`}
            >
              {busy ? "처리 중..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
