/* eslint-disable react-hooks/refs --
   Sticky-ref pattern: stickyHsvHue, stickyHslHue/Saturation, stickyCmykCyan/
   Magenta/Yellow are deliberately read during render to drive thumb positions
   and channel gradients. Re-renders are always triggered by setRgb() in event
   handlers, so the values are current. The refs intentionally bypass the RGB
   round-trip to prevent hue drift on degenerate colors (black, white, gray →
   hue=0 from any conversion). */
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChannelRow } from './ChannelRow'
import { SwatchButton } from './SwatchButton'

// ##############
// # COLOR MATH #
// ##############

function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
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

function rgbToHsv(red: number, green: number, blue: number): [number, number, number] {
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

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
   red /= 255; green /= 255; blue /= 255
   const max = Math.max(red, green, blue), min = Math.min(red, green, blue)
   const lightness = (max + min) / 2
   if (max === min) return [0, 0, Math.round(lightness * 100)]
   const delta = max - min
   const saturationHSL = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
   let hueHSL = 0
   if      (max === red)   hueHSL = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
   else if (max === green) hueHSL = ((blue - red) / delta + 2) / 6
   else                    hueHSL = ((red - green) / delta + 4) / 6
   return [Math.round(hueHSL * 360), Math.round(saturationHSL * 100), Math.round(lightness * 100)]
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
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

function rgbToCmyk(red: number, green: number, blue: number): [number, number, number, number] {
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

function cmykToRgb(cyan: number, magenta: number, yellow: number, black: number): [number, number, number] {
   cyan /= 100; magenta /= 100; yellow /= 100; black /= 100
   return [
      Math.round(255 * (1 - cyan) * (1 - black)),
      Math.round(255 * (1 - magenta) * (1 - black)),
      Math.round(255 * (1 - yellow) * (1 - black)),
   ]
}

function hexToRgb(hex: string): [number, number, number] | null {
   const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
   return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

function rgbToHex(red: number, green: number, blue: number): string {
   return '#' + [red, green, blue].map(component => Math.max(0, Math.min(255, component)).toString(16).padStart(2, '0')).join('')
}

// ##################
// # MAIN COMPONENT #
// ##################

type ColorMode = 'hex' | 'rgb' | 'hsl' | 'cmyk'
const MODES: ColorMode[] = ['hex', 'rgb', 'hsl', 'cmyk']

export interface ColorPickerProps {
   /** Current color, `#rrggbb`. Fully controlled. */
   value: string
   /** Live change — fires continuously during slider drag / hex typing. */
   onChange: (hex: string) => void
   /** "Default colors" row. Clickable display only; omit to hide the row. */
   swatches?: string[]
   /** Recents row. Clickable display only; omit to hide the row. */
   recentColors?: string[]
   /** Discrete commit — swatch click, hex completed, slider pointer-up. */
   onColorCommitted?: (hex: string) => void
   /** Label above the `swatches` row. */
   swatchesLabel?: string
   /** Label above the `recentColors` row. */
   recentLabel?: string
}

export function ColorPicker({
   value,
   onChange,
   swatches,
   recentColors,
   onColorCommitted,
   swatchesLabel = 'Default colors',
   recentLabel = 'Recent',
}: ColorPickerProps) {
   const [mode, setMode] = useState<ColorMode>('hex')

   // ===================
   //  Internal RGB state
   // ===================
   // Source of truth. Avoids the prop→hex→derive feedback loop that causes
   // degenerate color conversions (e.g. hsl(*, *, 100%) always → [0,0,100]).
   const emittedHex = useRef(value)
   const [rgb, setRgb] = useState<[number, number, number]>(() => hexToRgb(value) ?? [249, 115, 22])

   const [red, green, blue]     = rgb
   const [, hsvSaturation, hsvValue] = rgbToHsv(red, green, blue)
   const [,, hslLightness]      = rgbToHsl(red, green, blue)
   const [cyan, magenta, yellow, black] = rgbToCmyk(red, green, blue)

   // ============
   //  Sticky refs
   // ============
   // Preserve hue/saturation through degenerate colors (black, white, gray).
   // Only updated explicitly in onChange handlers and on external value changes,
   // never from derived RGB round-trips, which introduce rounding drift.
   const stickyHsvHue        = useRef(rgbToHsv(red, green, blue)[0])
   const stickyHslHue        = useRef(rgbToHsl(red, green, blue)[0])
   const stickyHslSaturation = useRef(rgbToHsl(red, green, blue)[1])
   const stickyCmykCyan      = useRef(cyan)
   const stickyCmykMagenta   = useRef(magenta)
   const stickyCmykYellow    = useRef(yellow)

   // Refresh the sticky refs from a color that arrived from outside our own
   // emissions (external prop change, or a swatch/recent click). Degenerate
   // components are left untouched so hue/saturation survive.
   const updateStickyRefs = useCallback((parsed: [number, number, number]) => {
      const [newHsvHue, newHsvSaturation, newHsvValue] = rgbToHsv(...parsed)
      const [newHslHue, newHslSaturation, newHslLightness] = rgbToHsl(...parsed)
      const [newCyan, newMagenta, newYellow, newBlack] = rgbToCmyk(...parsed)
      if (newHsvSaturation > 0 && newHsvValue > 0) stickyHsvHue.current = newHsvHue
      if (newHslLightness > 0 && newHslLightness < 100) {
         stickyHslHue.current = newHslHue
         if (newHslSaturation > 0) stickyHslSaturation.current = newHslSaturation
      }
      if (newBlack < 100) {
         stickyCmykCyan.current = newCyan
         stickyCmykMagenta.current = newMagenta
         stickyCmykYellow.current = newYellow
      }
   }, [])

   // Only sync from external prop changes, not our own emissions.
   // Also update sticky refs from the new external color.
   useEffect(() => {
      if (value !== emittedHex.current) {
         const parsed = hexToRgb(value)
         if (parsed) {
            setRgb(parsed)
            updateStickyRefs(parsed)
         }
      }
   }, [value, updateStickyRefs])

   const pureHue = rgbToHex(...hsvToRgb(stickyHsvHue.current, 100, 100))

   const emit = useCallback((newRgb: [number, number, number]) => {
      const hex = rgbToHex(...newRgb)
      emittedHex.current = hex
      setRgb(newRgb)
      onChange(hex)
   }, [onChange])

   // Discrete commit of the last-emitted color.
   const commit = useCallback(() => {
      onColorCommitted?.(emittedHex.current)
   }, [onColorCommitted])

   // Swatch / recent click: apply the color (state + sticky refs) then commit.
   const selectSwatch = useCallback((color: string) => {
      const parsed = hexToRgb(color)
      if (!parsed) return
      const hex = rgbToHex(...parsed)
      emittedHex.current = hex
      setRgb(parsed)
      updateStickyRefs(parsed)
      onChange(hex)
      onColorCommitted?.(hex)
   }, [onChange, onColorCommitted, updateStickyRefs])

   // ====================
   //  SV square & hue bar
   // ====================
   const svRef  = useRef<HTMLDivElement>(null)
   const hueRef = useRef<HTMLDivElement>(null)

   function pickSV(event: React.PointerEvent<HTMLDivElement>) {
      const element = svRef.current; if (!element) return
      const rect = element.getBoundingClientRect()
      const newSaturation = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left)  / rect.width))  * 100)
      const newValue      = Math.round(Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)) * 100)
      emit(hsvToRgb(stickyHsvHue.current, newSaturation, newValue))
   }

   function pickHue(event: React.PointerEvent<HTMLDivElement>) {
      const element = hueRef.current; if (!element) return
      const rect = element.getBoundingClientRect()
      const newHue = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 360)
      stickyHsvHue.current = newHue
      emit(hsvToRgb(newHue, hsvSaturation, hsvValue))
   }

   // ==========
   //  Hex input
   // ==========
   const currentHex = rgbToHex(red, green, blue)
   const [hexRaw, setHexRaw] = useState(currentHex.replace('#', ''))
   useEffect(() => { setHexRaw(currentHex.replace('#', '')) }, [currentHex])

   return (
      <div className="pqc-root">

         {/* ========== */}
         {/*  SV square */}
         {/* ========== */}
         <div
            ref={svRef}
            className="pqc-sv"
            style={{
               background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${pureHue})`,
            }}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickSV(event) }}
            onPointerMove={event => { if (event.buttons === 0) return; pickSV(event) }}
            onPointerUp={commit}
         >
            <div
               className="pqc-sv-thumb"
               style={{ left: `${hsvSaturation}%`, top: `${100 - hsvValue}%` }}
            />
         </div>

         {/* ======== */}
         {/*  Hue bar */}
         {/* ======== */}
         <div
            ref={hueRef}
            className="pqc-hue"
            style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickHue(event) }}
            onPointerMove={event => { if (event.buttons === 0) return; pickHue(event) }}
            onPointerUp={commit}
         >
            <div
               className="pqc-hue-thumb"
               style={{ left: `${(stickyHsvHue.current / 360) * 100}%`, background: pureHue }}
            />
         </div>

         {/* ========== */}
         {/*  Mode tabs */}
         {/* ========== */}
         <div className="pqc-tabs">
            {MODES.map(colorMode => (
               <button
                  key={colorMode}
                  type="button"
                  onClick={() => setMode(colorMode)}
                  className={`pqc-tab${mode === colorMode ? ' pqc-tab--active' : ''}`}
               >
                  {colorMode}
               </button>
            ))}
         </div>

         {/* ============= */}
         {/*  Mode content */}
         {/* ============= */}
         <div className="pqc-mode">

            {mode === 'hex' && (
               <div className="pqc-hex-row">
                  <div className="pqc-hex-swatch" style={{ background: currentHex }} />
                  <div className="pqc-hex-field">
                     <span className="pqc-hex-hash">#</span>
                     <input
                        type="text"
                        value={hexRaw}
                        onChange={event => {
                           const inputElement = event.target
                           const cleaned = inputElement.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
                           setHexRaw(cleaned)
                           if (cleaned.length === 6) {
                              const parsed = hexToRgb('#' + cleaned)
                              if (parsed) {
                                 emit(parsed)
                                 // emit() -> onChange() may synchronously re-render and move DOM
                                 // focus elsewhere (a controlled parent can steal it). Reclaim
                                 // focus so the user can keep typing uninterrupted.
                                 inputElement.focus()
                                 onColorCommitted?.(rgbToHex(...parsed))
                              }
                           }
                        }}
                        maxLength={6}
                        spellCheck={false}
                        className="pqc-hex-input"
                        placeholder="rrggbb"
                     />
                  </div>
               </div>
            )}

            {mode === 'rgb' && (
               <>
                  <ChannelRow label="R" labelColor="#e55" value={red} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(0,${green},${blue}), rgb(255,${green},${blue}))`}
                     onChange={channelValue => emit([channelValue, green, blue])} />
                  <ChannelRow label="G" labelColor="#5a5" value={green} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},0,${blue}), rgb(${red},255,${blue}))`}
                     onChange={channelValue => emit([red, channelValue, blue])} />
                  <ChannelRow label="B" labelColor="#59f" value={blue} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},${green},0), rgb(${red},${green},255))`}
                     onChange={channelValue => emit([red, green, channelValue])} />
               </>
            )}

            {mode === 'hsl' && (
               <>
                  <ChannelRow label="H" labelColor="#aaa" value={stickyHslHue.current} min={0} max={360} onCommit={commit}
                     gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
                     onChange={channelValue => { stickyHslHue.current = channelValue; emit(hslToRgb(channelValue, stickyHslSaturation.current, hslLightness)) }} />
                  <ChannelRow label="S" labelColor="#aaa" value={stickyHslSaturation.current} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},0%,${hslLightness}%), hsl(${stickyHslHue.current},100%,${hslLightness}%))`}
                     onChange={channelValue => { stickyHslSaturation.current = channelValue; emit(hslToRgb(stickyHslHue.current, channelValue, hslLightness)) }} />
                  <ChannelRow label="L" labelColor="#aaa" value={hslLightness} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,0%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,50%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,100%))`}
                     onChange={channelValue => emit(hslToRgb(stickyHslHue.current, stickyHslSaturation.current, channelValue))} />
               </>
            )}

            {mode === 'cmyk' && (
               <>
                  <ChannelRow label="C" labelColor="#22c8d8" value={cyan} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(0,stickyCmykMagenta.current,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(100,stickyCmykMagenta.current,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykCyan.current = channelValue; emit(cmykToRgb(channelValue, stickyCmykMagenta.current, stickyCmykYellow.current, black)) }} />
                  <ChannelRow label="M" labelColor="#e840a0" value={magenta} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,0,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,100,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykMagenta.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, channelValue, stickyCmykYellow.current, black)) }} />
                  <ChannelRow label="Y" labelColor="#c8b800" value={yellow} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,0,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,100,black))})`}
                     onChange={channelValue => { stickyCmykYellow.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, channelValue, black)) }} />
                  <ChannelRow label="K" labelColor="#888" value={black} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,0))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,100))})`}
                     onChange={channelValue => emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, stickyCmykYellow.current, channelValue))} />
               </>
            )}

         </div>

         {/* ============================ */}
         {/*  Swatches & recents (display) */}
         {/* ============================ */}
         {swatches && swatches.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label">{swatchesLabel}</span>
               <div className="pqc-swatch-grid">
                  {swatches.map((color, index) => (
                     <SwatchButton key={`swatch-${index}-${color}`} color={color} onSelect={selectSwatch} />
                  ))}
               </div>
            </div>
         )}

         {recentColors && recentColors.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label">{recentLabel}</span>
               <div className="pqc-swatch-grid">
                  {recentColors.map((color, index) => (
                     <SwatchButton key={`recent-${index}-${color}`} color={color} onSelect={selectSwatch} />
                  ))}
               </div>
            </div>
         )}
      </div>
   )
}
