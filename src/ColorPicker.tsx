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
   hsvToRgb, rgbToHsv, rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb, rgbToHex, hexToRgba, rgbaToHex,
} from './color'

// The EyeDropper API isn't in the DOM lib types yet.
interface EyeDropper { open(): Promise<{ sRGBHex: string }> }
declare global {
   interface Window { EyeDropper?: { new (): EyeDropper } }
}

// ##################
// # MAIN COMPONENT #
// ##################

type ColorMode = 'hex' | 'rgb' | 'hsl' | 'cmyk'
const MODES: ColorMode[] = ['hex', 'rgb', 'hsl', 'cmyk']

/**
 * What triggered an `onColorCommitted` call, so a consumer can react differently
 * per interaction (e.g. close the picker only on a `'swatch'` click).
 * - `'swatch'` / `'recent'` — a click in the default-colors / recents row
 * - `'input'` — a value typed into the hex field or a channel number box
 * - `'slider'` — a drag or keypress on the SV square, hue / opacity bar, or a channel slider
 * - `'eyedropper'` — a color picked with the screen eyedropper
 */
export type CommitSource = 'swatch' | 'recent' | 'input' | 'slider' | 'eyedropper'

// Join a base class with any truthy extras.
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

/** Extra classes for individual parts, added alongside each part's built-in `pqc-*` class. */
export interface ColorPickerClassNames {
   svSquare?: string
   svThumb?: string
   hueBar?: string
   hueThumb?: string
   alphaBar?: string
   alphaThumb?: string
   tabList?: string
   /** Every tab. */
   tab?: string
   /** The active tab, in addition to `tab`. */
   tabActive?: string
   slider?: string
   sliderThumb?: string
   swatch?: string
}

export interface ColorPickerProps {
   /** Current color. `#rrggbb`, or `#rrggbbaa` when `alpha` is on. Fully controlled. */
   value: string
   /** Live change — fires continuously during slider drag / hex typing. Same width as `value`. */
   onChange: (hex: string) => void
   /** Enable the opacity channel: adds an alpha slider and widens hex to 8 digits. Default `false`. */
   alpha?: boolean
   /** "Default colors" row. Clickable display only; omit to hide the row. */
   swatches?: string[]
   /** Recents row. Clickable display only; omit to hide the row. */
   recentColors?: string[]
   /** Discrete commit (swatch click, completed hex, slider release). `source` says which. */
   onColorCommitted?: (hex: string, source: CommitSource) => void
   /** Label above the `swatches` row. */
   swatchesLabel?: string
   /** Label above the `recentColors` row. */
   recentLabel?: string
   /** Place the swatches + recents block above or below the picker body. Default `'bottom'`. */
   swatchesPosition?: 'top' | 'bottom'
   /** Appended to the root's class, alongside `pqc-root`. */
   className?: string
   /** Merged onto the root element's inline style — handy for setting `--pqc-*` tokens. */
   style?: CSSProperties
   /** Extra classes for individual parts (SV square, thumbs, tabs, sliders, swatches…). */
   classNames?: ColorPickerClassNames
}

export function ColorPicker({
   value,
   onChange,
   alpha: alphaEnabled = false,
   swatches,
   recentColors,
   onColorCommitted,
   swatchesLabel = 'Default colors',
   recentLabel = 'Recent',
   swatchesPosition = 'bottom',
   className,
   style,
   classNames,
}: ColorPickerProps) {
   const [mode, setMode] = useState<ColorMode>('hex')

   // ===================
   //  Internal RGB state
   // ===================
   // Source of truth. Avoids the prop→hex→derive feedback loop that causes
   // degenerate color conversions (e.g. hsl(*, *, 100%) always → [0,0,100]).
   const emittedHex = useRef(value)
   const [rgb, setRgb] = useState<[number, number, number]>(() => {
      const parsed = hexToRgba(value)
      return parsed ? [parsed[0], parsed[1], parsed[2]] : [249, 115, 22]
   })

   // Opacity, stored as the 0-255 byte (lossless with the hex AA byte). It rides
   // alongside RGB and never enters the sticky-ref / conversion machinery — alpha
   // is orthogonal to hue. `alphaRef` mirrors it so `emit` can read the current
   // value without being recreated on every alpha-drag frame.
   const [alpha, setAlpha] = useState<number>(() => hexToRgba(value)?.[3] ?? 255)
   const alphaRef = useRef(alpha)
   useEffect(() => { alphaRef.current = alpha }, [alpha])

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
   // Also update sticky refs (and alpha) from the new external color.
   useEffect(() => {
      if (value !== emittedHex.current) {
         const parsed = hexToRgba(value)
         if (parsed) {
            const [pr, pg, pb, pa] = parsed
            // Deliberate: pull the external controlled value into our RGB source
            // of truth. Guarded by the emittedHex check so our own emissions
            // don't loop back through here.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRgb([pr, pg, pb])
            if (alphaEnabled) setAlpha(pa)
            updateStickyRefs([pr, pg, pb])
         }
      }
   }, [value, alphaEnabled, updateStickyRefs])

   const pureHue = rgbToHex(...hsvToRgb(stickyHsvHue.current, 100, 100))

   // A color edit resyncs the sticky refs of every space EXCEPT the one whose
   // slider is being dragged: that space just set its own refs to exact values,
   // and resyncing would round-trip and drift them. `owner` names that space;
   // null means the color jumped wholesale (hex / RGB entry) so everything
   // resyncs. This keeps the non-edited modes — and the always-visible SV square
   // + hue bar — in step, instead of only refreshing on swatch / external change.
   // `nextAlpha` defaults to the current alpha (read via ref so alpha drags don't
   // recreate this callback). The emitted hex carries the alpha byte only when the
   // feature is on, so the no-alpha path stays byte-identical to before.
   const emit = useCallback((newRgb: [number, number, number], owner: 'hsv' | 'hsl' | 'cmyk' | null = null, nextAlpha: number = alphaRef.current) => {
      const hex = alphaEnabled ? rgbaToHex(...newRgb, nextAlpha) : rgbToHex(...newRgb)
      emittedHex.current = hex
      setRgb(newRgb)
      if (nextAlpha !== alphaRef.current) setAlpha(nextAlpha)
      if (owner !== 'hsv')  syncHsvHue(newRgb)
      if (owner !== 'hsl')  syncHsl(newRgb)
      if (owner !== 'cmyk') syncCmyk(newRgb)
      onChange(hex)
   }, [alphaEnabled, onChange, syncHsvHue, syncHsl, syncCmyk])

   // Discrete commit of the last-emitted color, tagged with what triggered it.
   const commit = useCallback((source: CommitSource) => {
      onColorCommitted?.(emittedHex.current, source)
   }, [onColorCommitted])

   // Swatch / recent click: apply the color (state + sticky refs + alpha) then
   // commit. A 6-digit swatch is fully opaque; an 8-digit one applies its alpha.
   const selectSwatch = useCallback((color: string, source: 'swatch' | 'recent') => {
      const parsed = hexToRgba(color)
      if (!parsed) return
      const [pr, pg, pb, pa] = parsed
      const newRgb: [number, number, number] = [pr, pg, pb]
      const hex = alphaEnabled ? rgbaToHex(pr, pg, pb, pa) : rgbToHex(pr, pg, pb)
      emittedHex.current = hex
      setRgb(newRgb)
      if (alphaEnabled) setAlpha(pa)
      updateStickyRefs(newRgb)
      onChange(hex)
      onColorCommitted?.(hex, source)
   }, [alphaEnabled, onChange, onColorCommitted, updateStickyRefs])

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
   //  Alpha bar
   // ==========
   // Presented and driven in whole percent (0-100), stored as the 0-255 byte.
   // An imported byte is preserved until the slider is touched; the color itself
   // is unchanged, so this only moves the alpha byte.
   const alphaBarRef = useRef<HTMLDivElement>(null)
   const alphaPercent = Math.round((alpha / 255) * 100)

   function pickAlpha(event: React.PointerEvent<HTMLDivElement>) {
      const element = alphaBarRef.current; if (!element) return
      const rect = element.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      emit(rgb, null, Math.round(ratio * 255))
   }

   function keyAlpha(event: React.KeyboardEvent<HTMLDivElement>) {
      let percent = alphaPercent
      switch (event.key) {
         case 'ArrowRight': case 'ArrowUp':   percent += event.shiftKey ? 10 : 1; break
         case 'ArrowLeft':  case 'ArrowDown': percent -= event.shiftKey ? 10 : 1; break
         case 'PageUp':   percent += 10; break
         case 'PageDown': percent -= 10; break
         case 'Home':     percent = 0; break
         case 'End':      percent = 100; break
         default: return
      }
      event.preventDefault()
      percent = Math.max(0, Math.min(100, percent))
      emit(rgb, null, Math.round((percent / 100) * 255))
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
   const currentHex = alphaEnabled ? rgbaToHex(red, green, blue, alpha) : rgbToHex(red, green, blue)
   const [hexRaw, setHexRaw] = useState(currentHex.replace('#', ''))
   // While the field is focused the user's typing is the source of truth — don't
   // let the live color clobber a half-typed entry (e.g. auto-fill 6 → 8 chars).
   const hexFocused = useRef(false)
   useEffect(() => { if (!hexFocused.current) setHexRaw(currentHex.replace('#', '')) }, [currentHex])

   // Parse a raw hex entry (shorthand included) and apply it. Complete lengths are
   // 6 or (with alpha) 8; shorthand 3, or 4 with alpha. Returns whether it applied.
   // `recents` gates onColorCommitted so it fires once on settle, not per keystroke.
   function commitHex(raw: string, recents: boolean): boolean {
      const lengths = alphaEnabled ? [3, 4, 6, 8] : [3, 6]
      if (!lengths.includes(raw.length)) return false
      const parsed = hexToRgba('#' + raw)
      if (!parsed) return false
      emit([parsed[0], parsed[1], parsed[2]], null, parsed[3])
      if (recents) onColorCommitted?.(emittedHex.current, 'input')
      return true
   }

   // ==================
   //  Eyedropper & copy
   // ==================
   // Detect the EyeDropper API after mount, so SSR and first client render agree
   // (the button is absent both times, then appears once the client confirms it).
   const [hasEyeDropper, setHasEyeDropper] = useState(false)
   // eslint-disable-next-line react-hooks/set-state-in-effect
   useEffect(() => { setHasEyeDropper(typeof window !== 'undefined' && 'EyeDropper' in window) }, [])

   async function pickScreen() {
      if (!window.EyeDropper) return
      try {
         const { sRGBHex } = await new window.EyeDropper().open()
         const parsed = hexToRgba(sRGBHex)
         if (parsed) {
            // Screen-picked colors are opaque; keep the user's current opacity.
            emit([parsed[0], parsed[1], parsed[2]], null, alphaRef.current)
            onColorCommitted?.(emittedHex.current, 'eyedropper')
         }
      } catch {
         // The user dismissed the picker (Esc) — nothing to do.
      }
   }

   const [copied, setCopied] = useState(false)
   const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
   useEffect(() => () => clearTimeout(copyTimer.current), [])

   function copyHex() {
      if (!navigator.clipboard) return
      navigator.clipboard.writeText(currentHex).then(() => {
         setCopied(true)
         clearTimeout(copyTimer.current)
         copyTimer.current = setTimeout(() => setCopied(false), 1200)
      }).catch(() => { /* clipboard blocked — no feedback */ })
   }

   // Every channel slider shares the same part-level classes; spread onto each row.
   const rowSlots = { sliderClassName: classNames?.slider, sliderThumbClassName: classNames?.sliderThumb }

   // The swatches + recents rows move as one block; `swatchesPosition` places it
   // above or below the picker body. Reordered in the DOM (not CSS) so reading
   // and focus order follow the visual order.
   const swatchesBlock = (
      <>
         {swatches && swatches.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label" id={`${tabsId}-swatches-label`}>{swatchesLabel}</span>
               <div className="pqc-swatch-grid" role="group" aria-labelledby={`${tabsId}-swatches-label`}>
                  {swatches.map((color, index) => (
                     <SwatchButton key={`swatch-${index}-${color}`} color={color} onSelect={c => selectSwatch(c, 'swatch')} className={classNames?.swatch} />
                  ))}
               </div>
            </div>
         )}

         {recentColors && recentColors.length > 0 && (
            <div className="pqc-swatches">
               <span className="pqc-swatches-label" id={`${tabsId}-recent-label`}>{recentLabel}</span>
               <div className="pqc-swatch-grid" role="group" aria-labelledby={`${tabsId}-recent-label`}>
                  {recentColors.map((color, index) => (
                     <SwatchButton key={`recent-${index}-${color}`} color={color} onSelect={c => selectSwatch(c, 'recent')} className={classNames?.swatch} />
                  ))}
               </div>
            </div>
         )}
      </>
   )

   return (
      <div className={`pqc-root${className ? ` ${className}` : ''}`} style={{ ...style, ['--pqc-_hue' as string]: pureHue } as CSSProperties}>

         {swatchesPosition === 'top' && swatchesBlock}


         {/* ========== */}
         {/*  SV square */}
         {/* ========== */}
         <div
            ref={svRef}
            className={cx('pqc-sv', classNames?.svSquare)}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`Saturation ${hsvSaturation}%, brightness ${hsvValue}%`}
            onKeyDown={keySV}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickSV(event) }}
            onPointerMove={event => { if (event.buttons === 0) return; pickSV(event) }}
            onPointerUp={() => commit('slider')}
            onBlur={() => commit('slider')}
         >
            <div
               className={cx('pqc-sv-thumb', classNames?.svThumb)}
               style={{ ['--pqc-_x' as string]: `${hsvSaturation}%`, ['--pqc-_y' as string]: `${100 - hsvValue}%` } as CSSProperties}
            />
         </div>

         {/* ======== */}
         {/*  Hue bar */}
         {/* ======== */}
         <div
            ref={hueRef}
            className={cx('pqc-hue', classNames?.hueBar)}
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
            onPointerUp={() => commit('slider')}
            onBlur={() => commit('slider')}
         >
            <div
               className={cx('pqc-hue-thumb', classNames?.hueThumb)}
               style={{ ['--pqc-_x' as string]: `${(stickyHsvHue.current / 360) * 100}%` } as CSSProperties}
            />
         </div>

         {/* ========= */}
         {/*  Alpha bar */}
         {/* ========= */}
         {alphaEnabled && (
            <div
               ref={alphaBarRef}
               className={cx('pqc-alpha', classNames?.alphaBar)}
               role="slider"
               tabIndex={0}
               aria-label="Opacity"
               aria-valuemin={0}
               aria-valuemax={100}
               aria-valuenow={alphaPercent}
               aria-valuetext={`${alphaPercent}%`}
               onKeyDown={keyAlpha}
               onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickAlpha(event) }}
               onPointerMove={event => { if (event.buttons === 0) return; pickAlpha(event) }}
               onPointerUp={() => commit('slider')}
               onBlur={() => commit('slider')}
            >
               <div
                  className="pqc-alpha-fill"
                  style={{ ['--pqc-_rgb' as string]: `${red} ${green} ${blue}` } as CSSProperties}
               />
               <div className={cx('pqc-alpha-thumb', classNames?.alphaThumb)} style={{ ['--pqc-_x' as string]: `${alphaPercent}%` } as CSSProperties} />
            </div>
         )}

         {/* ========== */}
         {/*  Mode tabs */}
         {/* ========== */}
         <div className={cx('pqc-tabs', classNames?.tabList)} role="tablist" aria-label="Color format">
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
                  className={cx('pqc-tab', mode === colorMode && 'pqc-tab--active', classNames?.tab, mode === colorMode && classNames?.tabActive)}
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
                  <div className="pqc-hex-swatch">
                     <div className="pqc-hex-swatch-fill" style={{ ['--pqc-_fill' as string]: currentHex } as CSSProperties} />
                  </div>
                  <div className="pqc-hex-field">
                     <span className="pqc-hex-hash">#</span>
                     <input
                        type="text"
                        value={hexRaw}
                        onFocus={() => { hexFocused.current = true }}
                        onChange={event => {
                           const inputElement = event.target
                           const cleaned = inputElement.value.replace(/[^0-9a-f]/gi, '').slice(0, alphaEnabled ? 8 : 6)
                           setHexRaw(cleaned)
                           // Live color update at full lengths only — 6, or 8 with alpha (a
                           // 6-digit entry reads as opaque). Shorthand waits for settle so
                           // typing a long value never flickers through its 3-char prefix.
                           if (cleaned.length === 6 || (alphaEnabled && cleaned.length === 8)) {
                              commitHex(cleaned, false)
                              // emit() may re-render and move focus (a controlled parent can
                              // steal it). Reclaim so the user keeps typing uninterrupted.
                              inputElement.focus()
                           }
                        }}
                        onKeyDown={event => { if (event.key === 'Enter') commitHex(hexRaw, true) }}
                        onBlur={() => {
                           hexFocused.current = false
                           // Settle: expand shorthand / a 6-digit opaque entry and record it.
                           commitHex(hexRaw, true)
                           setHexRaw(currentHex.replace('#', ''))
                        }}
                        maxLength={alphaEnabled ? 8 : 6}
                        spellCheck={false}
                        className="pqc-hex-input"
                        placeholder={alphaEnabled ? 'rrggbbaa' : 'rrggbb'}
                     />
                     {alphaEnabled && (
                        <span className="pqc-hex-opacity" aria-hidden="true">{alphaPercent}%</span>
                     )}
                  </div>
                  {hasEyeDropper && (
                     <button type="button" className="pqc-icon-btn" aria-label="Pick a color from the screen" onClick={pickScreen}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                           <path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" />
                           <path d="m15 6 3.4-3.4c.8-.8 2.2-.8 3 0 .8.8.8 2.2 0 3L18 9l.4.4c.8.8.8 2.2 0 3-.8.8-2.2.8-3 0l-3.8-3.8c-.8-.8-.8-2.2 0-3 .8-.8 2.2-.8 3 0l.4.4Z" />
                        </svg>
                     </button>
                  )}
                  <button type="button" className="pqc-icon-btn" aria-label={copied ? 'Copied' : 'Copy hex'} onClick={copyHex}>
                     {copied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                           <path d="M20 6 9 17l-5-5" />
                        </svg>
                     ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                           <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                           <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                     )}
                  </button>
               </div>
            )}

            {mode === 'rgb' && (
               <>
                  <ChannelRow {...rowSlots} label="R" ariaLabel="Red" labelColor="#e55" value={red} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(0,${green},${blue}), rgb(255,${green},${blue}))`}
                     onChange={channelValue => emit([channelValue, green, blue])} />
                  <ChannelRow {...rowSlots} label="G" ariaLabel="Green" labelColor="#5a5" value={green} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},0,${blue}), rgb(${red},255,${blue}))`}
                     onChange={channelValue => emit([red, channelValue, blue])} />
                  <ChannelRow {...rowSlots} label="B" ariaLabel="Blue" labelColor="#59f" value={blue} min={0} max={255} onCommit={commit}
                     gradient={`linear-gradient(to right, rgb(${red},${green},0), rgb(${red},${green},255))`}
                     onChange={channelValue => emit([red, green, channelValue])} />
               </>
            )}

            {mode === 'hsl' && (
               <>
                  <ChannelRow {...rowSlots} label="H" ariaLabel="Hue" labelColor="#aaa" value={stickyHslHue.current} min={0} max={360} onCommit={commit}
                     gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
                     onChange={channelValue => { stickyHslHue.current = channelValue; emit(hslToRgb(channelValue, stickyHslSaturation.current, hslLightness), 'hsl') }} />
                  <ChannelRow {...rowSlots} label="S" ariaLabel="Saturation" labelColor="#aaa" value={stickyHslSaturation.current} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},0%,${hslLightness}%), hsl(${stickyHslHue.current},100%,${hslLightness}%))`}
                     onChange={channelValue => { stickyHslSaturation.current = channelValue; emit(hslToRgb(stickyHslHue.current, channelValue, hslLightness), 'hsl') }} />
                  <ChannelRow {...rowSlots} label="L" ariaLabel="Lightness" labelColor="#aaa" value={hslLightness} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,0%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,50%), hsl(${stickyHslHue.current},${stickyHslSaturation.current}%,100%))`}
                     onChange={channelValue => emit(hslToRgb(stickyHslHue.current, stickyHslSaturation.current, channelValue), 'hsl')} />
               </>
            )}

            {mode === 'cmyk' && (
               <>
                  <ChannelRow {...rowSlots} label="C" ariaLabel="Cyan" labelColor="#22c8d8" value={cyan} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(0,stickyCmykMagenta.current,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(100,stickyCmykMagenta.current,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykCyan.current = channelValue; emit(cmykToRgb(channelValue, stickyCmykMagenta.current, stickyCmykYellow.current, black), 'cmyk') }} />
                  <ChannelRow {...rowSlots} label="M" ariaLabel="Magenta" labelColor="#e840a0" value={magenta} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,0,stickyCmykYellow.current,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,100,stickyCmykYellow.current,black))})`}
                     onChange={channelValue => { stickyCmykMagenta.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, channelValue, stickyCmykYellow.current, black), 'cmyk') }} />
                  <ChannelRow {...rowSlots} label="Y" ariaLabel="Yellow" labelColor="#c8b800" value={yellow} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,0,black))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,100,black))})`}
                     onChange={channelValue => { stickyCmykYellow.current = channelValue; emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, channelValue, black), 'cmyk') }} />
                  <ChannelRow {...rowSlots} label="K" ariaLabel="Black" labelColor="#888" value={black} min={0} max={100} onCommit={commit}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,0))}, ${rgbToHex(...cmykToRgb(stickyCmykCyan.current,stickyCmykMagenta.current,stickyCmykYellow.current,100))})`}
                     onChange={channelValue => emit(cmykToRgb(stickyCmykCyan.current, stickyCmykMagenta.current, stickyCmykYellow.current, channelValue), 'cmyk')} />
               </>
            )}

         </div>

         {/* ============================ */}
         {/*  Swatches & recents (display) */}
         {/* ============================ */}
         {swatchesPosition === 'bottom' && swatchesBlock}
      </div>
   )
}
