import { useState, useEffect } from 'react'
import { ChannelSlider } from './ChannelSlider'

export interface ChannelRowProps {
   label:      string
   labelColor: string
   value:      number
   min:        number
   max:        number
   gradient:   string
   onChange:   (value: number) => void
   /** Discrete commit — slider pointer-up, or the number input's Enter/blur. */
   onCommit?:  () => void
}

export function ChannelRow({ label, labelColor, value, min, max, gradient, onChange, onCommit }: ChannelRowProps) {
   const [rawInput, setRawInput] = useState(String(value))
   useEffect(() => { setRawInput(String(value)) }, [value])

   function commit(rawValue: string) {
      const parsedValue = parseInt(rawValue, 10)
      if (!isNaN(parsedValue)) onChange(Math.max(min, Math.min(max, parsedValue)))
      setRawInput(String(value))
      onCommit?.()
   }

   return (
      <div className="pqc-channel-row">
         <span className="pqc-channel-label" style={{ color: labelColor }}>
            {label}
         </span>
         <ChannelSlider value={value} min={min} max={max} gradient={gradient} onChange={onChange} onCommit={onCommit} />
         <input
            type="text"
            inputMode="numeric"
            value={rawInput}
            onChange={event => { setRawInput(event.target.value) }}
            onBlur={event => commit(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') commit((event.target as HTMLInputElement).value) }}
            className="pqc-channel-input"
         />
      </div>
   )
}
