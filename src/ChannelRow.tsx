import { useState, useEffect } from 'react'
import { ChannelSlider } from './ChannelSlider'

export interface ChannelRowProps {
   label:      string
   labelColor: string
   /** Full accessible name for the channel (e.g. "Red") — the visible `label` is a single letter. */
   ariaLabel:  string
   value:      number
   min:        number
   max:        number
   gradient:   string
   onChange:   (value: number) => void
   /** Discrete commit — slider pointer-up / blur, or the number input's Enter/blur. */
   onCommit?:  () => void
}

export function ChannelRow({ label, labelColor, ariaLabel, value, min, max, gradient, onChange, onCommit }: ChannelRowProps) {
   const [rawInput, setRawInput] = useState(String(value))
   // Mirror the committed numeric value back into the editable field.
   // eslint-disable-next-line react-hooks/set-state-in-effect
   useEffect(() => { setRawInput(String(value)) }, [value])

   function commit(rawValue: string) {
      const parsedValue = parseInt(rawValue, 10)
      if (!isNaN(parsedValue)) onChange(Math.max(min, Math.min(max, parsedValue)))
      setRawInput(String(value))
      onCommit?.()
   }

   return (
      <div className="pqc-channel-row">
         <span className="pqc-channel-label" style={{ color: labelColor }} aria-hidden="true">
            {label}
         </span>
         <ChannelSlider value={value} min={min} max={max} gradient={gradient} ariaLabel={ariaLabel} onChange={onChange} onCommit={onCommit} />
         <input
            type="text"
            inputMode="numeric"
            aria-label={ariaLabel}
            value={rawInput}
            onChange={event => { setRawInput(event.target.value) }}
            onBlur={event => commit(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') commit((event.target as HTMLInputElement).value) }}
            className="pqc-channel-input"
         />
      </div>
   )
}
