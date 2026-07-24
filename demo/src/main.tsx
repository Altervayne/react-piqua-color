import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorPicker } from 'react-piqua-color'
import 'react-piqua-color/style.css'
import './demo.css'

const SWATCHES = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#000000', '#ffffff']

function hexToRgb(hex: string): [number, number, number] {
   const n = parseInt(hex.slice(1, 7), 16) // ignore any trailing alpha byte
   return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function App() {
   const [color, setColor] = useState('#f97316')
   // The consumer owns recents — cap and dedupe here, not in the picker.
   const [recents, setRecents] = useState<string[]>([])
   const [dark, setDark] = useState(false)
   const [swatchesTop, setSwatchesTop] = useState(false)
   const [alpha, setAlpha] = useState(false)
   const [lastSource, setLastSource] = useState('—')
   // The eyedropper is Chromium-only; detect it so the hint matches reality.
   const [hasEyeDropper, setHasEyeDropper] = useState(false)
   useEffect(() => { setHasEyeDropper('EyeDropper' in window) }, [])
   const [r, g, b] = hexToRgb(color)

   return (
      <div className={`demo${dark ? ' demo--dark' : ''}`}>
         <div className="demo-inner">
            <header className="demo-head">
               <h1>react-piqua-color</h1>
               <div className="demo-actions">
                  <button type="button" className="demo-toggle" onClick={() => setAlpha(value => !value)}>
                     Alpha: {alpha ? 'on' : 'off'}
                  </button>
                  <button type="button" className="demo-toggle" onClick={() => setSwatchesTop(value => !value)}>
                     Swatches: {swatchesTop ? 'top' : 'bottom'}
                  </button>
                  <button type="button" className="demo-toggle" onClick={() => setDark(value => !value)}>
                     {dark ? '☀ Light' : '☾ Dark'}
                  </button>
               </div>
            </header>

            <div className="demo-grid">
               <div className="demo-card">
                  <ColorPicker
                     className={dark ? 'pqc-dark' : undefined}
                     value={color}
                     onChange={setColor}
                     alpha={alpha}
                     swatches={SWATCHES}
                     recentColors={recents}
                     swatchesPosition={swatchesTop ? 'top' : 'bottom'}
                     onColorCommitted={(committed, source) => {
                        setRecents(previous => [committed, ...previous.filter(entry => entry !== committed)].slice(0, 12))
                        setLastSource(source)
                     }}
                  />
               </div>

               <aside className="demo-preview">
                  <div className="demo-chip" style={{ background: color }} />
                  <dl className="demo-readout">
                     <dt>hex</dt><dd>{color}</dd>
                     <dt>rgb</dt><dd>{r}, {g}, {b}</dd>
                     <dt>recents</dt><dd>{recents.length}</dd>
                     <dt>committed via</dt><dd>{lastSource}</dd>
                  </dl>
                  <p className="demo-hint">
                     {hasEyeDropper
                        ? 'The hex tab has an eyedropper (pick any on-screen color) and a copy button. '
                        : 'The hex tab has a copy button; the eyedropper is Chromium-only, so it is hidden on this browser. '}
                     Everything is keyboard operable: Tab to a control, then arrows
                     (two-dimensional on the SV square), shift+arrows, home / end.
                  </p>
               </aside>
            </div>
         </div>
      </div>
   )
}

// Reuse the root across HMR re-executions of this entry, so editing the demo
// doesn't warn about calling createRoot() twice on the same container.
const container = document.getElementById('root')! as HTMLElement & { _root?: ReturnType<typeof createRoot> }
container._root ??= createRoot(container)
container._root.render(
   <StrictMode>
      <App />
   </StrictMode>,
)
