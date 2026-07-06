// 숫자만 입력해도 입력 중에 실시간으로 구분자를 넣어주는 공용 포맷터
export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  const len = digits.length
  if (len < 4) return digits
  if (len < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (len === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function formatBusinessNumber(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  const len = digits.length
  if (len < 4) return digits
  if (len < 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function formatDateText(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const len = digits.length
  if (len < 5) return digits
  if (len < 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}
