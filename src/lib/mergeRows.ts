// 서버에서 다시 받아온 행 배열을 기존 배열과 합칠 때, 실제로 안 바뀐 행은 이전 객체 참조를
// 그대로 재사용한다. 그래야 React.memo로 감싼 셀들이 "안 바뀐 행"에 대해 리렌더를 건너뛸 수 있다
// (그냥 setLocalRows(rows)로 통째로 교체하면 모든 행 객체가 새 참조가 되어 화면 전체가 다시 그려진다).
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
