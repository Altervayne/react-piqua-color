import { describe, it, expect } from 'vitest'
import {
   hsvToRgb, rgbToHsv, rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb, hexToRgb, rgbToHex, hexToRgba, rgbaToHex,
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

describe('hexToRgba', () => {
   it('parses eight-digit hex with and without the hash', () => {
      expect(hexToRgba('#ff000080')).toEqual([255, 0, 0, 128])
      expect(hexToRgba('00ff00ff')).toEqual([0, 255, 0, 255])
   })

   it('treats six-digit input as fully opaque', () => {
      expect(hexToRgba('#ff0000')).toEqual([255, 0, 0, 255])
   })

   it('is case-insensitive', () => {
      expect(hexToRgba('#AABBCCDD')).toEqual([170, 187, 204, 221])
   })

   it('handles the alpha byte edges', () => {
      expect(hexToRgba('#11223300')).toEqual([17, 34, 51, 0])
      expect(hexToRgba('#112233ff')).toEqual([17, 34, 51, 255])
   })

   it('expands 3- and 4-digit shorthand by nibble-doubling', () => {
      expect(hexToRgba('#abc')).toEqual([170, 187, 204, 255])   // #aabbcc, opaque
      expect(hexToRgba('#abcd')).toEqual([170, 187, 204, 221])  // #aabbccdd
      expect(hexToRgba('#f008')).toEqual([255, 0, 0, 136])
   })

   it('rejects malformed input', () => {
      expect(hexToRgba('#12')).toBeNull()           // 2 digits
      expect(hexToRgba('#12345')).toBeNull()         // 5 digits
      expect(hexToRgba('#1234567')).toBeNull()       // 7 digits
      expect(hexToRgba('#ff00g0aa')).toBeNull()      // non-hex digit
      expect(hexToRgba('')).toBeNull()
   })
})

describe('rgbaToHex', () => {
   it('formats and zero-pads the alpha byte', () => {
      expect(rgbaToHex(255, 0, 0, 128)).toBe('#ff000080')
      expect(rgbaToHex(0, 0, 0, 0)).toBe('#00000000')
      expect(rgbaToHex(17, 34, 51, 255)).toBe('#112233ff')
   })

   it('clamps and rounds out-of-range components including alpha', () => {
      expect(rgbaToHex(-10, 300, 128, 999)).toBe('#00ff80ff')
      expect(rgbaToHex(0, 0, 0, -5)).toBe('#00000000')
   })

   it('emits six digits when includeAlpha is false (no-alpha parity)', () => {
      expect(rgbaToHex(255, 0, 0, 128, false)).toBe('#ff0000')
      SAMPLES.forEach(([r, g, b]) => expect(rgbaToHex(r, g, b, 255, false)).toBe(rgbToHex(r, g, b)))
   })

   it('round-trips losslessly with hexToRgba — no tolerance', () => {
      const alphas = [0, 1, 64, 127, 128, 129, 200, 254, 255]
      SAMPLES.forEach(([r, g, b], i) => {
         const a = alphas[i % alphas.length]
         expect(hexToRgba(rgbaToHex(r, g, b, a))).toEqual([r, g, b, a])
      })
   })

   it('preserves the low alpha byte a 0-100 percent model would corrupt', () => {
      expect(hexToRgba(rgbaToHex(1, 2, 3, 129))).toEqual([1, 2, 3, 129])
      expect(hexToRgba(rgbaToHex(1, 2, 3, 81))).toEqual([1, 2, 3, 81])
   })
})
