"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface Result {
  imgRef: RefObject<HTMLImageElement | null>;
  renderedWidth: number | null;
  renderedHeight: number | null;
  error: string | null;
}

// 서버에서 미리 렌더링된 계약서 이미지의 실제 표시 크기를 추적한다.
// pdf.js 캔버스 렌더링과 달리 브라우저의 ES 모듈/워커 지원 여부와 무관하게 동작한다.
export function usePdfPreviewImage(imageUrl: string | null): Result {
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(
    imageUrl ? null : "계약서 이미지를 생성하지 못했습니다.",
  );

  useEffect(() => {
    if (!imageUrl) return;
    const img = imgRef.current;
    if (!img) return;
    setSize(null);
    setError(null);

    function measure() {
      const rect = img!.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    }

    function handleError() {
      setError("계약서 이미지를 불러오지 못했습니다.");
    }

    img.addEventListener("load", measure);
    img.addEventListener("error", handleError);
    if (img.complete && img.naturalWidth > 0) measure();

    const ro = new ResizeObserver(measure);
    ro.observe(img);

    return () => {
      img.removeEventListener("load", measure);
      img.removeEventListener("error", handleError);
      ro.disconnect();
    };
  }, [imageUrl]);

  return {
    imgRef,
    renderedWidth: size?.width ?? null,
    renderedHeight: size?.height ?? null,
    error,
  };
}
