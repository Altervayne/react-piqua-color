import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorPicker } from 'react-piqua-color'
import 'react-piqua-color/style.css'
import './demo.css'

const SWATCHES = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#000000', '#ffffff']

function hexToRgb(hex: string): [number, number, number] {
   const n = parseInt(hex.slice(1), 16)
   return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function App() {
   const [color, setColor] = useState('#f97316')
   // The consumer owns recents — cap and dedupe here, not in the picker.
   const [recents, setRecents] = useState<string[]>([])
   const [dark, setDark] = useState(false)
   const [swatchesTop, setSwatchesTop] = useState(false)
   const [r, g, b] = hexToRgb(color)

   return (
      <div className={`demo${dark ? ' demo--dark' : ''}`}>
         <div className="demo-inner">
            <header className="demo-head">
               <h1>react-piqua-color</h1>
               <div className="demo-actions">
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
                     swatches={SWATCHES}
                     recentColors={recents}
                     swatchesPosition={swatchesTop ? 'top' : 'bottom'}
                     onColorCommitted={committed =>
                        setRecents(previous => [committed, ...previous.filter(entry => entry !== committed)].slice(0, 12))
                     }
                  />
               </div>

               <aside className="demo-preview">
                  <div className="demo-chip" style={{ background: color }} />
                  <dl className="demo-readout">
                     <dt>hex</dt><dd>{color}</dd>
                     <dt>rgb</dt><dd>{r}, {g}, {b}</dd>
                     <dt>recents</dt><dd>{recents.length}</dd>
                  </dl>
                  <p className="demo-hint">
                     Tab to any control, then arrows / shift+arrows / home / end.
                     The SV square takes two-dimensional arrows.
                  </p>
               </aside>
            </div>
         </div>
      </div>
   )
}

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <App />
   </StrictMode>,
)
