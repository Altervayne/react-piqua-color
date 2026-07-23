// ##############
// # COLOR MATH #
// ##############
// Pure conversions between the color spaces the picker exposes. All channel
// ranges are the human-facing ones: hue 0-360, saturation/value/lightness and
// cmyk 0-100, rgb 0-255. Results are rounded to integers — round-trips are
// therefore lossy by a unit or two, which the picker's sticky-hue refs exist
// to paper over on degenerate colors.

export function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
   saturation /= 100; value /= 100
   const chroma = value * saturation
   const intermediate = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
   const offset = value - chroma
   let red = 0, green = 0, blue = 0
   if      (hue < 60)  { red = chroma; green = intermediate }
   else if (hue < 120) { red = intermediate; green = chroma }
   else if (hue < 180) { green = chroma; blue = intermediate }
   else if (hue < 240) { green = intermediate; blue = chroma }
   else if (hue < 300) { red = intermediate; blue = chroma }
   else                { red = chroma; blue = intermediate }
   return [Math.round((red + offset) * 255), Math.round((green + offset) * 255), Math.round((blue + offset) * 255)]
}

export function rgbToHsv(red: number, green: number, blue: number): [number, number, number] {
   red /= 255; green /= 255; blue /= 255
   const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min
   const valueHSV = max, saturationHSV = max === 0 ? 0 : delta / max
   let hueHSV = 0
   if (delta !== 0) {
      if      (max === red)   hueHSV = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
      else if (max === green) hueHSV = ((blue - red) / delta + 2) / 6
      else                    hueHSV = ((red - green) / delta + 4) / 6
   }
   return [Math.round(hueHSV * 360), Math.round(saturationHSV * 100), Math.round(valueHSV * 100)]
}

export function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
   red /= 255; green /= 255; blue /= 255
   const max = Math.max(red, green, blue), min = Math.min(red, green, blue)
   const lightness = (max + min) / 2
   if (max === min) return [0, 0, Math.round(lightness * 100)]
   const delta = max - min
   const saturationHSL = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
   let hueHSL: number // max === min already returned above, so one branch always assigns
   if      (max === red)   hueHSL = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
   else if (max === green) hueHSL = ((blue - red) / delta + 2) / 6
   else                    hueHSL = ((red - green) / delta + 4) / 6
   return [Math.round(hueHSL * 360), Math.round(saturationHSL * 100), Math.round(lightness * 100)]
}

export function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
   hue /= 360; saturation /= 100; lightness /= 100
   if (saturation === 0) { const gray = Math.round(lightness * 255); return [gray, gray, gray] }
   const quadrant = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
   const base = 2 * lightness - quadrant
   const hueChannel = (hueInput: number) => {
      hueInput = ((hueInput % 1) + 1) % 1
      if (hueInput < 1/6) return base + (quadrant - base) * 6 * hueInput
      if (hueInput < 1/2) return quadrant
      if (hueInput < 2/3) return base + (quadrant - base) * (2/3 - hueInput) * 6
      return base
   }
   return [Math.round(hueChannel(hue + 1/3) * 255), Math.round(hueChannel(hue) * 255), Math.round(hueChannel(hue - 1/3) * 255)]
}

export function rgbToCmyk(red: number, green: number, blue: number): [number, number, number, number] {
   red /= 255; green /= 255; blue /= 255
   const black = 1 - Math.max(red, green, blue)
   if (black >= 1) return [0, 0, 0, 100]
   return [
      Math.round(((1 - red - black) / (1 - black)) * 100),
      Math.round(((1 - green - black) / (1 - black)) * 100),
      Math.round(((1 - blue - black) / (1 - black)) * 100),
      Math.round(black * 100),
   ]
}

export function cmykToRgb(cyan: number, magenta: number, yellow: number, black: number): [number, number, number] {
   cyan /= 100; magenta /= 100; yellow /= 100; black /= 100
   return [
      Math.round(255 * (1 - cyan) * (1 - black)),
      Math.round(255 * (1 - magenta) * (1 - black)),
      Math.round(255 * (1 - yellow) * (1 - black)),
   ]
}

export function hexToRgb(hex: string): [number, number, number] | null {
   const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
   return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

export function rgbToHex(red: number, green: number, blue: number): string {
   return '#' + [red, green, blue].map(component => Math.max(0, Math.min(255, component)).toString(16).padStart(2, '0')).join('')
}
