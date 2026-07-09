

export function mergeRowsPreservingIdentity<T extends { id: string; updated_at?: string }>(
  prev: T[],
  next: T[]
): T[] {
  const prevById = new Map(prev.map(r => [r.id, r]))
  return next.map(row => {
    const old = prevById.get(row.id)
    if (old && old.updated_at === row.updated_at) return old
    return row
  })
}
