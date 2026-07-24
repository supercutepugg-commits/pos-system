export interface RatioRect {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pixelToRatio(px: PixelRect, canvasWidth: number, canvasHeight: number): RatioRect {
  return {
    xRatio: px.x / canvasWidth,
    yRatio: px.y / canvasHeight,
    widthRatio: px.width / canvasWidth,
    heightRatio: px.height / canvasHeight,
  };
}

export function ratioToPixel(r: RatioRect, canvasWidth: number, canvasHeight: number): PixelRect {
  return {
    x: r.xRatio * canvasWidth,
    y: r.yRatio * canvasHeight,
    width: r.widthRatio * canvasWidth,
    height: r.heightRatio * canvasHeight,
  };
}

export function isRatioRect(v: unknown): v is RatioRect {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.xRatio === "number" &&
    typeof r.yRatio === "number" &&
    typeof r.widthRatio === "number" &&
    typeof r.heightRatio === "number"
  );
}
