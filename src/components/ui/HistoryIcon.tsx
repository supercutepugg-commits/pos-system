// 히스토리 버튼용 곰돌이 아이콘
export default function HistoryIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 76"
      width={size}
      height={size * (76 / 60)}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="8" r="6" fill="#F5A93C" stroke="#1A1A1A" strokeWidth="2.2" />
      <circle cx="44" cy="8" r="6" fill="#F5A93C" stroke="#1A1A1A" strokeWidth="2.2" />
      <circle cx="30" cy="26" r="24" fill="#F5A93C" stroke="#1A1A1A" strokeWidth="2.2" />
      <rect x="15" y="16.5" width="10" height="2.6" rx="1.3" fill="#1A1A1A" />
      <rect x="35" y="16.5" width="10" height="2.6" rx="1.3" fill="#1A1A1A" />
      <circle cx="20" cy="24" r="1.8" fill="#1A1A1A" />
      <circle cx="40" cy="24" r="1.8" fill="#1A1A1A" />
      <circle cx="30" cy="30" r="2.2" fill="#1A1A1A" />
      <path
        d="M22 34c1.5 3 4.8 5 8 5s6.5-2 8-5"
        stroke="#1A1A1A"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M30 34v3" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
      <rect
        x="14"
        y="50"
        width="32"
        height="24"
        rx="14"
        fill="#F5A93C"
        stroke="#1A1A1A"
        strokeWidth="2.2"
      />
      <path d="M22 50c0 8 3.6 14 8 14s8-6 8-14" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2" />
    </svg>
  );
}
