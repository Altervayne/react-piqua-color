import { describe, it, expect } from 'vitest'
import {
   hsvToRgb, rgbToHsv, rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb, hexToRgb, rgbToHex,
} from './color'

// A spread of colors to exercise round-trips: primaries, secondaries, the
// achromatic axis, and a few arbitrary mid-tones.
const SAMPLES: [number, number, number][] = [
   [255, 0, 0], [0, 255, 0], [0, 0, 255],
   [255, 255, 0], [0, 255, 255], [255, 0, 255],
   [0, 0, 0], [255, 255, 255], [128, 128, 128],
   [249, 115, 22], [59, 130, 246], [168, 85, 247], [17, 94, 60],
]

// Round-tripping through 0-100 quantized spaces (hsv/hsl/cmyk) is lossy by a
// couple of units per channel; assert closeness, not equality.
function expectClose(actual: [number, number, number], expected: [number, number, number], tolerance: number) {
   actual.forEach((component, index) => {
      expect(Math.abs(component - expected[index])).toBeLessThanOrEqual(tolerance)
   })
}

describe('hexToRgb', () => {
   it('parses six-digit hex with and without the hash', () => {
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
      expect(hexToRgb('00ff00')).toEqual([0, 255, 0])
   })

   it('is case-insensitive', () => {
      expect(hexToRgb('#AABBCC')).toEqual([170, 187, 204])
      expect(hexToRgb('#aabbcc')).toEqual([170, 187, 204])
   })

   it('rejects malformed input', () => {
      expect(hexToRgb('#fff')).toBeNull()       // shorthand is not supported
      expect(hexToRgb('#ff00')).toBeNull()       // wrong length
      expect(hexToRgb('#ff00gg')).toBeNull()     // non-hex digits
      expect(hexToRgb('')).toBeNull()
      expect(hexToRgb('#1234567')).toBeNull()
   })
})

describe('rgbToHex', () => {
   it('formats and zero-pads', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
      expect(rgbToHex(0, 0, 0)).toBe('#000000')
      expect(rgbToHex(17, 34, 51)).toBe('#112233')
   })

   it('clamps out-of-range components', () => {
      expect(rgbToHex(-10, 300, 128)).toBe('#00ff80')
   })

   it('round-trips with hexToRgb', () => {
      SAMPLES.forEach(([r, g, b]) => {
         expect(hexToRgb(rgbToHex(r, g, b))).toEqual([r, g, b])
      })
   })
})

describe('rgbToHsv', () => {
   it('maps anchor colors', () => {
      expect(rgbToHsv(255, 0, 0)).toEqual([0, 100, 100])
      expect(rgbToHsv(0, 255, 0)).toEqual([120, 100, 100])
      expect(rgbToHsv(0, 0, 255)).toEqual([240, 100, 100])
      expect(rgbToHsv(255, 255, 255)).toEqual([0, 0, 100])
      expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0])
   })

   it('reports hue 0 for every gray — the degeneracy the sticky refs guard', () => {
      expect(rgbToHsv(64, 64, 64)[1]).toBe(0)
      expect(rgbToHsv(200, 200, 200)[1]).toBe(0)
   })
})

describe('hsvToRgb', () => {
   it('maps anchor colors', () => {
      expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0])
      expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0])
      expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255])
      expect(hsvToRgb(0, 0, 100)).toEqual([255, 255, 255])
      expect(hsvToRgb(0, 0, 0)).toEqual([0, 0, 0])
   })

   it('wraps hue 360 back to red', () => {
      expect(hsvToRgb(360, 100, 100)).toEqual([255, 0, 0])
   })

   it('round-trips rgb → hsv → rgb', () => {
      SAMPLES.forEach(rgb => expectClose(hsvToRgb(...rgbToHsv(...rgb)), rgb, 3))
   })
})

describe('rgbToHsl', () => {
   it('maps anchor colors', () => {
      expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
      expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
      expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
      expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 50])
   })
})

describe('hslToRgb', () => {
   it('maps anchor colors', () => {
      expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0])
      expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0])
      expect(hslToRgb(0, 0, 50)).toEqual([128, 128, 128])
   })

   it('treats saturation 0 as a pure gray at any hue', () => {
      expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255])
      expect(hslToRgb(200, 0, 0)).toEqual([0, 0, 0])
   })

   it('round-trips rgb → hsl → rgb', () => {
      SAMPLES.forEach(rgb => expectClose(hslToRgb(...rgbToHsl(...rgb)), rgb, 3))
   })
})

describe('rgbToCmyk', () => {
   it('maps anchor colors', () => {
      expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 100])
      expect(rgbToCmyk(255, 255, 255)).toEqual([0, 0, 0, 0])
      expect(rgbToCmyk(255, 0, 0)).toEqual([0, 100, 100, 0])
      expect(rgbToCmyk(0, 255, 0)).toEqual([100, 0, 100, 0])
      expect(rgbToCmyk(0, 0, 255)).toEqual([100, 100, 0, 0])
   })
})

describe('cmykToRgb', () => {
   it('maps anchor colors', () => {
      expect(cmykToRgb(0, 0, 0, 100)).toEqual([0, 0, 0])
      expect(cmykToRgb(0, 0, 0, 0)).toEqual([255, 255, 255])
      expect(cmykToRgb(0, 100, 100, 0)).toEqual([255, 0, 0])
   })

   it('round-trips rgb → cmyk → rgb', () => {
      SAMPLES.forEach(rgb => expectClose(cmykToRgb(...rgbToCmyk(...rgb)), rgb, 3))
   })
})
