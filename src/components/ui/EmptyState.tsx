export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
