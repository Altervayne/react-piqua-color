import type { CSSProperties } from 'react'

export interface SwatchButtonProps {
   color:      string
   onSelect:   (color: string) => void
   className?: string
}

/**
 * A single clickable color square. Self-contained — the picker renders one of
 * these per entry in the `swatches` / `recentColors` arrays it is handed. It
 * holds no state and persists nothing; selection is delegated to the parent.
 */
export function SwatchButton({ color, onSelect, className }: SwatchButtonProps) {
   return (
      <button
         type="button"
         className={className ? `pqc-swatch ${className}` : 'pqc-swatch'}
         title={color}
         aria-label={color}
         onClick={() => onSelect(color)}
      >
         {/* Fill sits over the checkerboard base so a color with alpha reads as transparent. */}
         <span className="pqc-swatch-fill" style={{ ['--pqc-_fill' as string]: color } as CSSProperties} />
      </button>
   )
}
