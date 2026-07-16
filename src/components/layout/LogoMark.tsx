export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <mask id="sidebar-logo-knockout">
        <rect x="0" y="0" width="100" height="100" fill="#fff" />
        <circle cx="50" cy="50" r="13" fill="#000" />
      </mask>
      <g mask="url(#sidebar-logo-knockout)" fill="#86BE72">
        <rect x="43" y="8" width="14" height="36" rx="7" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(45 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(90 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(135 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(180 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(225 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(270 50 50)" />
        <rect x="43" y="8" width="14" height="36" rx="7" transform="rotate(315 50 50)" />
      </g>
    </svg>
  );
}
