import type { CSSProperties } from 'react'

export interface SwatchButtonProps {
   color:      string
   onSelect:   (color: string) => void
   className?: string
   /** Whether this swatch equals the current color (shown with a selected ring). */
   selected?:  boolean
}

/**
 * A single clickable color square. Self-contained — the picker renders one of
 * these per entry in the `swatches` / `recentColors` arrays it is handed. It
 * holds no state and persists nothing; selection is delegated to the parent.
 */
export function SwatchButton({ color, onSelect, className, selected }: SwatchButtonProps) {
   const cls = `pqc-swatch${selected ? ' pqc-swatch--selected' : ''}${className ? ` ${className}` : ''}`
   return (
      <button
         type="button"
         className={cls}
         title={color}
         aria-label={color}
         aria-current={selected || undefined}
         onClick={() => onSelect(color)}
      >
         {/* Checkerboard, then the fill on top, both clipped to the button's shape. */}
         <span className="pqc-swatch-checker" />
         <span className="pqc-swatch-fill" style={{ ['--pqc-_fill' as string]: color } as CSSProperties} />
      </button>
   )
}
