export interface SwatchButtonProps {
   color:    string
   onSelect: (color: string) => void
}

/**
 * A single clickable color square. Self-contained — the picker renders one of
 * these per entry in the `swatches` / `recentColors` arrays it is handed. It
 * holds no state and persists nothing; selection is delegated to the parent.
 */
export function SwatchButton({ color, onSelect }: SwatchButtonProps) {
   return (
      <button
         type="button"
         className="pqc-swatch"
         style={{ background: color }}
         title={color}
         aria-label={color}
         onClick={() => onSelect(color)}
      />
   )
}
