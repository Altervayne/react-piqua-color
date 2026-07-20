import { useRef } from 'react'

export interface ChannelSliderProps {
   value:     number
   min:       number
   max:       number
   gradient:  string
   onChange:  (value: number) => void
   /** Discrete commit — fires once on pointer-up (end of a drag). */
   onCommit?: () => void
}

export function ChannelSlider({ value, min, max, gradient, onChange, onCommit }: ChannelSliderProps) {
   const trackRef = useRef<HTMLDivElement>(null)

   function pick(event: React.PointerEvent<HTMLDivElement>) {
      const element = trackRef.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      const positionRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
      onChange(Math.round(min + positionRatio * (max - min)))
   }

   const percent = ((value - min) / (max - min)) * 100

   return (
      <div
         ref={trackRef}
         className="pqc-slider"
         style={{ background: gradient }}
         onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pick(event) }}
         onPointerMove={event => { if (event.buttons === 0) return; pick(event) }}
         onPointerUp={() => onCommit?.()}
      >
         <div className="pqc-slider-thumb" style={{ left: `${percent}%` }} />
      </div>
   )
}
