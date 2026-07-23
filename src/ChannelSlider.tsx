import { useRef } from 'react'

export interface ChannelSliderProps {
   value:     number
   min:       number
   max:       number
   gradient:  string
   /** Accessible name for the slider (e.g. "Red", "Hue") — the visible letter is too terse for a screen reader. */
   ariaLabel: string
   onChange:  (value: number) => void
   /** Discrete commit — fires on pointer-up (end of a drag) and on blur (end of a keyboard session). */
   onCommit?: () => void
}

const STEP = 1
const STEP_LARGE = 10

export function ChannelSlider({ value, min, max, gradient, ariaLabel, onChange, onCommit }: ChannelSliderProps) {
   const trackRef = useRef<HTMLDivElement>(null)

   function pick(event: React.PointerEvent<HTMLDivElement>) {
      const element = trackRef.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      const positionRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
      onChange(Math.round(min + positionRatio * (max - min)))
   }

   // Arrow / Page / Home / End nudging. Shift widens the arrow step. Each press
   // is a live onChange; the drag-equivalent commit happens on blur.
   function nudge(event: React.KeyboardEvent<HTMLDivElement>) {
      let next = value
      switch (event.key) {
         case 'ArrowRight': case 'ArrowUp':   next += event.shiftKey ? STEP_LARGE : STEP; break
         case 'ArrowLeft':  case 'ArrowDown': next -= event.shiftKey ? STEP_LARGE : STEP; break
         case 'PageUp':   next += STEP_LARGE; break
         case 'PageDown': next -= STEP_LARGE; break
         case 'Home':     next = min; break
         case 'End':      next = max; break
         default: return
      }
      event.preventDefault()
      next = Math.max(min, Math.min(max, next))
      if (next !== value) onChange(next)
   }

   const percent = ((value - min) / (max - min)) * 100

   return (
      <div
         ref={trackRef}
         className="pqc-slider"
         style={{ background: gradient }}
         role="slider"
         tabIndex={0}
         aria-label={ariaLabel}
         aria-valuemin={min}
         aria-valuemax={max}
         aria-valuenow={value}
         onKeyDown={nudge}
         onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pick(event) }}
         onPointerMove={event => { if (event.buttons === 0) return; pick(event) }}
         onPointerUp={() => onCommit?.()}
         onBlur={() => onCommit?.()}
      >
         <div className="pqc-slider-thumb" style={{ left: `${percent}%` }} />
      </div>
   )
}
