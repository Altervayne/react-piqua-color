/* eslint-disable react-hooks/refs --
   Sticky-ref pattern: stickyHsvHue, stickyHslHue/Saturation, stickyCmykCyan/
   Magenta/Yellow are deliberately read during render to drive thumb positions
   and channel gradients. Re-renders are always triggered by setRgb() in event
   handlers, so the values are current. The refs intentionally bypass the RGB
   round-trip to prevent hue drift on degenerate colors (black, white, gray →
   hue=0 from any conversion). */
import { useState, useRef, useEffect, useCallback, useId, type CSSProperties } from 'react'
import { ChannelRow } from './ChannelRow'
import { SwatchButton } from './SwatchButton'
import {
   hsvToRgb, rgbToHsv, rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb, hexToRgb, rgbToHex,
} from './color'

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
   /** Appended to the root's class, alongside `pqc-root`. */
   className?: string
   /** Merged onto the root element's inline style — handy for setting `--pqc-*` tokens. */
   style?: CSSProperties
}

export function ColorPicker({
   value,
   onChange,
   swatches,
   recentColors,
   onColorCommitted,
   swatchesLabel = 'Default colors',
   recentLabel = 'Recent',
   className,
   style,
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

   // Refresh one color space's sticky refs from an RGB triple. Degenerate
   // components (gray → no hue, black → no CMYK color) are left untouched so the
   // preserved value survives. These read authoritative RGB, never a ref's own
   // round-tripped output, so repeated calls don't drift.
   const syncHsvHue = useCallback((rgb: [number, number, number]) => {
      const [newHue, newSaturation, newValue] = rgbToHsv(...rgb)
      if (newSaturation > 0 && newValue > 0) stickyHsvHue.current = newHue
   }, [])
   const syncHsl = useCallback((rgb: [number, number, number]) => {
      const [newHue, newSaturation, newLightness] = rgbToHsl(...rgb)
      if (newLightness > 0 && newLightness < 100) {
         stickyHslHue.current = newHue
         if (newSaturation > 0) stickyHslSaturation.current = newSaturation
      }
   }, [])
   const syncCmyk = useCallback((rgb: [number, number, number]) => {
      const [newCyan, newMagenta, newYellow, newBlack] = rgbToCmyk(...rgb)
      if (newBlack < 100) {
         stickyCmykCyan.current = newCyan
         stickyCmykMagenta.current = newMagenta
         stickyCmykYellow.current = newYellow
      }
   }, [])

   // Refresh every sticky ref — for a color that arrives wholesale (external prop,
   // swatch/recent click, hex/RGB entry) with no single channel being dragged.
   const updateStickyRefs = useCallback((parsed: [number, number, number]) => {
      syncHsvHue(parsed)
      syncHsl(parsed)
      syncCmyk(parsed)
   }, [syncHsvHue, syncHsl, syncCmyk])

   // Only sync from external prop changes, not our own emissions.
   // Also update sticky refs from the new external color.
   useEffect(() => {
      if (value !== emittedHex.current) {
         const parsed = hexToRgb(value)
         if (parsed) {
            // Deliberate: pull the external controlled value into our RGB source
            // of truth. Guarded by the emittedHex check so our own emissions
            // don't loop back through here.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRgb(parsed)
            updateStickyRefs(parsed)
         }
      }
   }, [value, updateStickyRefs])

   const pureHue = rgbToHex(...hsvToRgb(stickyHsvHue.current, 100, 100))

   // A color edit resyncs the sticky refs of every space EXCEPT the one whose
   // slider is being dragged: that space just set its own refs to exact values,
   // and resyncing would round-trip and drift them. `owner` names that space;
   // null means the color jumped wholesale (hex / RGB entry) so everything
   // resyncs. This keeps the non-edited modes — and the always-visible SV square
   // + hue bar — in step, instead of only refreshing on swatch / external change.
   const emit = useCallback((newRgb: [number, number, number], owner: 'hsv' | 'hsl' | 'cmyk' | null = null) => {
      const hex = rgbToHex(...newRgb)
      emittedHex.current = hex
      setRgb(newRgb)
      if (owner !== 'hsv')  syncHsvHue(newRgb)
      if (owner !== 'hsl')  syncHsl(newRgb)
      if (owner !== 'cmyk') syncCmyk(newRgb)
      onChange(hex)
   }, [onChange, syncHsvHue, syncHsl, syncCmyk])

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
      emit(hsvToRgb(stickyHsvHue.current, newSaturation, newValue), 'hsv')
   }

   function pickHue(event: React.PointerEvent<HTMLDivElement>) {
      const element = hueRef.current; if (!element) return
      const rect = element.getBoundingClientRect()
      const newHue = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 360)
      stickyHsvHue.current = newHue
      emit(hsvToRgb(newHue, hsvSaturation, hsvValue), 'hsv')
   }

   // Arrows drive saturation (X) and brightness (Y); Shift widens the step.
   // Hue is held via the sticky ref, exactly as during a pointer drag.
   function keySV(event: React.KeyboardEvent<HTMLDivElement>) {
      const step = event.shiftKey ? 10 : 1
      let newSaturation = hsvSaturation, newValue = hsvValue
      switch (event.key) {
         case 'ArrowRight': newSaturation += step; break
         case 'ArrowLeft':  newSaturation -= step; break
         case 'ArrowUp':    newValue += step; break
         case 'ArrowDown':  newValue -= step; break
         case 'Home':       newSaturation = 0; break
         case 'End':        newSaturation = 100; break
         default: return
      }
      event.preventDefault()
      newSaturation = Math.max(0, Math.min(100, newSaturation))
      newValue      = Math.max(0, Math.min(100, newValue))
      emit(hsvToRgb(stickyHsvHue.current, newSaturation, newValue), 'hsv')
   }

   function keyHue(event: React.KeyboardEvent<HTMLDivElement>) {
      let newHue = stickyHsvHue.current
      switch (event.key) {
         case 'ArrowRight': case 'ArrowUp':   newHue += event.shiftKey ? 10 : 1; break
         case 'ArrowLeft':  case 'ArrowDown': newHue -= event.shiftKey ? 10 : 1; break
         case 'PageUp':   newHue += 10; break
         case 'PageDown': newHue -= 10; break
         case 'Home':     newHue = 0; break
         case 'End':      newHue = 360; break
         default: return
      }
      event.preventDefault()
      newHue = Math.max(0, Math.min(360, newHue))
      stickyHsvHue.current = newHue
      emit(hsvToRgb(newHue, hsvSaturation, hsvValue), 'hsv')
   }

   // ==========
   //  Mode tabs
   // ==========
   const tabsId = useId()
   const panelId = `${tabsId}-panel`
   const tabId = (colorMode: ColorMode) => `${tabsId}-tab-${colorMode}`
   const tabRefs = useRef<Partial<Record<ColorMode, HTMLButtonElement | null>>>({})

   // Roving arrow navigation with automatic activation (WAI-ARIA tabs pattern).
   function keyTabs(event: React.KeyboardEvent<HTMLButtonElement>) {
      const index = MODES.indexOf(mode)
      let nextIndex: number
      switch (event.key) {
         case 'ArrowRight': nextIndex = (index + 1) % MODES.length; break
         case 'ArrowLeft':  nextIndex = (index - 1 + MODES.length) % MODES.length; break
         case 'Home':       nextIndex = 0; break
         case 'End':        nextIndex = MODES.length - 1; break
         default: return
      }
      event.preventDefault()
      const nextMode = MODES[nextIndex]
      setMode(nextMode)
      tabRefs.current[nextMode]?.focus()
   }

   // ==========
   //  Hex input
   // ==========
   const currentHex = rgbToHex(red, green, blue)
   const [hexRaw, setHexRaw] = useState(currentHex.replace('#', ''))
   // Keep the editable hex string in step with the live color from any source.
   // eslint-disable-next-line react-hooks/set-state-in-effect
   useEffect(() => { setHexRaw(currentHex.replace('#', '')) }, [currentHex])

   return (
      <div className={`pqc-root${className ? ` ${className}` : ''}`} style={style}>

         {/* ========== */}
         {/*  SV square */}
         {/* ========== */}
         <div
            ref={svRef}
            className="pqc-sv"
            style={{
               background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${pureHue})`,
            }}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`Saturation ${hsvSaturation}%, brightness ${hsvValue}%`}
            onKeyDown={keySV}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickSV(event) }}
            onPointerMove={event => { if (event.buttons === 0) return; pickSV(event) }}
            onPointerUp={commit}
            onBlur={commit}
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
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={stickyHsvHue.current}
            aria-valuetext={`${stickyHsvHue.current}°`}
            onKeyDown={keyHue}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickHue(event) }}
            onPointerMove={event => { if (event.buttons === 0) return; pickHue(event) }}
            onPointerUp={commit}
            onBlur={commit}
         >
            <div
               className="pqc-hue-thumb"
               style={{ left: `${(stickyHsvHue.current / 360) * 100}%`, background: pureHue }}
            />
         </div>

         {/* ========== */}
         {/*  Mode tabs */}
         {/* ========== */}
         <div className="pqc-tabs" role="tablist" aria-label="Color format">
            {MODES.map(colorMode => (
               <button
                  key={colorMode}
                  ref={element => { tabRefs.current[colorMode] = element }}
                  type="button"
                  role="tab"
                  id={tabId(colorMode)}
                  aria-selected={mode === colorMode}
                  aria-controls={panelId}
                  tabIndex={mode === colorMode ? 0 : -1}
                  onClick={() => setMode(colorMode)}
                  onKeyDown={keyTabs}
                  className={`pqc-tab${mode === colorMode ? ' pqc-tab--active' : ''}`}
               >
                  {colorMode}
               </button>
            ))}
         </div>

         {/* ============= */}
         {/*  Mode content */}
         {/* ============= */}
         <div className="pqc-mode" role="tabpanel" id={panelId} aria-labelledby={tabId(mode)}>

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
                  <ChannelRow label="R" ariaLabel="Red" labelColor="#e55" value={red} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(0,${green},${blue}), rgb(255,${green},${blue}))`}
                     onChange={channelValue => emit([channelValue, green, blue])} />
                  <ChannelRow label="G" ariaLabel="Green" labelColor="#5a5" value={green} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},0,${blue}), rgb(${red},255,${blue}))`}
                     onChange={channelValue => emit([red, channelValue, blue])} />
                  <ChannelRow label="B" ariaLabel="Blue" labelColor="#59f" value={blue} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},${green},0), rgb(${red},${green},255))`}
                     onChange={channelValue => emit([red, green, channelValue])} />
               </>
            )}

            {mode === 'hsl' && (
               <>
                  <ChannelRow label="H" ariaLabel="Hue" labelColor="#aaa" value={stickyHslHue.current} min={0} max={360} onCommit={commit}
                     gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
                     onChange={channelValue => { stickyHslHue.current = channelValue; emit(hslToRgb(channelValue, stickyHslSaturation.current, hslLightness), 'hsl') }} />
                  <ChannelRow label="S" ariaLabel="Saturation" labelColor="#aaa" value={stickyHslSaturation.current} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},0%,${hslLightness}%), hsl(${stickyHslHue.current},100%,${hslLightness}%))`}
                     onChange={channelValue => { stickyHslSaturation.current = channelValue; emit(hslToRgb(stickyHslHue.current, channelValue, hslLightness), 'hsl') }} />
                  <ChannelRow label="L" ariaLabel="Lightness" labelColor="#aaa" value={hslLightness} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,0%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,50%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,100%))`}
                     onChange={channelValue => emit(hslToRgb(stickyHslHue.current, stickyHslSaturation.current, channelValue), 'hsl')} />
               </>
            )}

            {mode === 'cmyk' && (
               <>
                  <ChannelRow label="C" ariaLabel="Cyan" labelColor="#22c8d8" value={cyan} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(0,stickyCmykMagenta.current,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(100,stickyCmykMagenta.current,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykCyan.current = channelValue; emit(cmykToRgb(channelValue, stickyCmykMagenta.current, stickyCmykYellow.current, black), 'cmyk') }} />
                  <ChannelRow label="M" ariaLabel="Magenta" labelColor="#e840a0" value={magenta} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,0,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,100,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykMagenta.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, channelValue, stickyCmykYellow.current, black), 'cmyk') }} />
                  <ChannelRow label="Y" ariaLabel="Yellow" labelColor="#c8b800" value={yellow} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,0,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,100,black))})`}
                     onChange={channelValue => { stickyCmykYellow.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, channelValue, black), 'cmyk') }} />
                  <ChannelRow label="K" ariaLabel="Black" labelColor="#888" value={black} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,0))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,100))})`}
                     onChange={channelValue => emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, stickyCmykYellow.current, channelValue), 'cmyk')} />
               </>
            )}

         </div>

         {/* ============================ */}
         {/*  Swatches & recents (display) */}
         {/* ============================ */}
         {swatches && swatches.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label" id={`${tabsId}-swatches-label`}>{swatchesLabel}</span>
               <div className="pqc-swatch-grid" role="group" aria-labelledby={`${tabsId}-swatches-label`}>
                  {swatches.map((color, index) => (
                     <SwatchButton key={`swatch-${index}-${color}`} color={color} onSelect={selectSwatch} />
                  ))}
               </div>
            </div>
         )}

         {recentColors && recentColors.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label" id={`${tabsId}-recent-label`}>{recentLabel}</span>
               <div className="pqc-swatch-grid" role="group" aria-labelledby={`${tabsId}-recent-label`}>
                  {recentColors.map((color, index) => (
                     <SwatchButton key={`recent-${index}-${color}`} color={color} onSelect={selectSwatch} />
                  ))}
               </div>
            </div>
         )}
      </div>
   )
}
