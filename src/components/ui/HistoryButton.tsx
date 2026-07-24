import HistoryIcon from "./HistoryIcon";

export default function HistoryButton({
  onClick,
  label = "히스토리",
  size = "large",
}: {
  onClick: () => void;
  label?: string;
  size?: "large" | "small";
}) {
  if (size === "small") {
    return (
      <button
        onClick={onClick}
        title={label}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 bg-white px-3 py-1.5 rounded-lg transition-colors"
      >
        <HistoryIcon size={16} />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-4 text-[36px] font-semibold text-slate-500 hover:text-blue-600 border-2 border-slate-200 hover:border-blue-400 bg-white px-7 py-4 rounded-2xl transition-all shadow-[0_0_10px_2px_rgba(59,130,246,0.35)] hover:shadow-[0_0_22px_6px_rgba(59,130,246,0.65)] animate-pulse hover:animate-none"
    >
      <HistoryIcon size={48} />
      {label}
    </button>
  );
}
