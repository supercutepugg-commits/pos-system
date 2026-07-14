import { describe, expect, it } from 'vitest'
import { isRatioRect, pixelToRatio, ratioToPixel } from './zoneCoords'

describe('PDF zone coordinates', () => {
  it('round-trips pixel coordinates through ratios', () => {
    const pixels = { x: 80, y: 120, width: 240, height: 60 }
    const ratio = pixelToRatio(pixels, 800, 1000)

    expect(ratio).toEqual({
      xRatio: 0.1,
      yRatio: 0.12,
      widthRatio: 0.3,
      heightRatio: 0.06,
    })
    expect(ratioToPixel(ratio, 800, 1000)).toEqual(pixels)
  })

  it('recognizes complete ratio rectangles only', () => {
    expect(isRatioRect({ xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1 })).toBe(true)
    expect(isRatioRect({ xRatio: 0, yRatio: 0, widthRatio: 1 })).toBe(false)
    expect(isRatioRect(null)).toBe(false)
  })
})
