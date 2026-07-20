# react-piqua-color

A portable, fully controlled React color picker. It renders an SV (saturation/value)
square, a hue bar, segmented mode tabs, and labelled channel sliders for
**hex / rgb / hsl / cmyk**. All the color math and the sticky-hue behaviour that keeps
hue stable through degenerate colors (black, white, gray) are baked in.

Styling is fully self-contained via a single stylesheet driven by CSS custom
properties — **no Tailwind, no CSS framework required**. Drop it into any React app.

## Install

```bash
npm install react-piqua-color
```

`react` and `react-dom` (>=18) are peer dependencies.

## Usage

```tsx
import { useState } from 'react'
import { ColorPicker } from 'react-piqua-color'
import 'react-piqua-color/style.css'

const DEFAULT_SWATCHES = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#000000', '#ffffff']

function Example() {
   const [color, setColor] = useState('#f97316')

   // The consumer owns recents storage — the picker never stores, caps, or dedupes.
   const [recents, setRecents] = useState<string[]>([])

   return (
      <ColorPicker
         value={color}
         onChange={setColor}                 // live: fires during slider drag / hex typing
         swatches={DEFAULT_SWATCHES}
         recentColors={recents}
         onColorCommitted={committedColor => {
            // discrete commit: swatch click, hex completed, slider pointer-up.
            setRecents(previous => [committedColor, ...previous.filter(existing => existing !== committedColor)].slice(0, 12))
         }}
      />
   )
}
```

The component is **fully controlled**: it renders `value`, calls `onChange` on every
live edit, and never holds the "official" color itself. The `swatches` and
`recentColors` arrays are **display-only** — the picker renders a clickable square per
entry and calls `onChange` then `onColorCommitted` when one is clicked. It stores,
caps, dedupes, and persists **nothing**; that is entirely the consumer's job.

## Props

| Prop               | Type                        | Required | Description                                                                                 |
| ------------------ | --------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `value`            | `string`                    | yes      | Current color as `#rrggbb`. Fully controlled.                                               |
| `onChange`         | `(hex: string) => void`     | yes      | Live change — fires continuously during slider drag and hex typing.                         |
| `onColorCommitted` | `(hex: string) => void`     | no       | Discrete commit — swatch click, a completed 6-digit hex, and slider pointer-up.             |
| `swatches`         | `string[]`                  | no       | "Default colors" row. Clickable display only; omit to hide the row.                         |
| `recentColors`     | `string[]`                  | no       | Recents row. Clickable display only; omit to hide the row.                                  |
| `swatchesLabel`    | `string`                    | no       | Label above the swatches row. Default `"Default colors"`.                                   |
| `recentLabel`      | `string`                    | no       | Label above the recents row. Default `"Recent"`.                                             |

## Theming

Import the stylesheet once (`import 'react-piqua-color/style.css'`). All theme colors
are CSS custom properties with sensible **light-mode defaults**. Override any of them
on a wrapping element (or `:root`) — for example, a dark theme:

```css
.my-dark-panel {
   --pqc-surface: #2a2d31;
   --pqc-bg: #1a1d21;
   --pqc-text: #e6e8eb;
   --pqc-muted: #9aa0a6;
   --pqc-border: #3a3d42;
   --pqc-accent: #f97316;
}
```

### Overridable variables

| Variable          | Default                    | Purpose                                          |
| ----------------- | -------------------------- | ------------------------------------------------ |
| `--pqc-surface`   | `#ffffff`                  | Raised surface — the active mode tab.            |
| `--pqc-bg`        | `#f1f2f4`                  | Recessed background — tab strip, hex field.      |
| `--pqc-text`      | `#1a1d21`                  | Primary text.                                    |
| `--pqc-muted`     | `#6b7280`                  | Secondary / muted text.                          |
| `--pqc-border`    | `#d4d7dd`                  | Hairline borders.                                |
| `--pqc-accent`    | `#f97316`                  | Accent (focus ring on swatches).                 |
| `--pqc-radius`    | `0.5rem`                   | Corner radius for larger surfaces.               |
| `--pqc-radius-sm` | `0.375rem`                 | Corner radius for small surfaces.                |
| `--pqc-thumb-ring`| `#ffffff`                  | Border color of the circular thumbs.             |
| `--pqc-font-mono` | system mono stack          | Monospace font used for values and labels.       |

Genuinely dynamic values — the SV/hue gradients, thumb positions, and per-channel
slider gradients — are computed and applied as inline styles, so they are not
themeable via CSS (they reflect the live color).

## License

MIT
