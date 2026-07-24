import Image from "next/image";

export default function LogoMark({ className }: { className?: string }) {
  return (
    <Image src="/posmos-mark.svg" alt="" width={28} height={28} unoptimized className={className} />
  );
}
