// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ColorPicker } from './ColorPicker'

afterEach(cleanup)

// A minimal controlled host — the picker feeds onChange straight back into value,
// which is what keeps its own emissions from being reverted by the external-sync
// effect (value === emittedHex).
function Controlled({ initial = '#f97316' }: { initial?: string }) {
   const [color, setColor] = useState(initial)
   return (
      <>
         <ColorPicker value={color} onChange={setColor} />
         <output data-testid="color">{color}</output>
      </>
   )
}

const hueValue = () => screen.getByRole('slider', { name: 'Hue' }).getAttribute('aria-valuenow')
const currentColor = () => screen.getByTestId('color').textContent

// Commit a channel value through its number input (change + Enter), addressed by
// its accessible name — the visible label is a single letter.
function setChannel(name: string, value: string) {
   const input = screen.getByRole('textbox', { name })
   fireEvent.change(input, { target: { value } })
   fireEvent.keyDown(input, { key: 'Enter' })
}

describe('ColorPicker — always-visible hue follows every edit path', () => {
   it('moves the hue bar to a freshly typed hex', () => {
      render(<Controlled />)
      expect(hueValue()).toBe('25') // #f97316
      fireEvent.change(screen.getByPlaceholderText('rrggbb'), { target: { value: '00ff00' } })
      expect(hueValue()).toBe('120') // green — regression guard: was stuck at 25
   })

   it('preserves hue when a degenerate (gray) hex is typed', () => {
      render(<Controlled />)
      const hex = screen.getByPlaceholderText('rrggbb')
      fireEvent.change(hex, { target: { value: '00ff00' } })
      expect(hueValue()).toBe('120')
      fireEvent.change(hex, { target: { value: '808080' } })
      expect(hueValue()).toBe('120') // gray has no hue of its own — the green is kept
   })
})

describe('ColorPicker — cross-mode sticky refs stay in step', () => {
   it('keeps the CMYK hold fresh after an HSL edit (no color jump)', () => {
      render(<Controlled initial="#ff0000" />)

      // Red → HSL hue 180 → cyan.
      fireEvent.click(screen.getByRole('tab', { name: 'hsl' }))
      setChannel('Hue', '180')
      expect(currentColor()).toBe('#00ffff')

      // In CMYK, darkening K must build on cyan's C/M/Y, not red's stale hold.
      // A stale hold would snap the color back to a dark red (#800000).
      fireEvent.click(screen.getByRole('tab', { name: 'cmyk' }))
      setChannel('Black', '50')
      expect(currentColor()).toBe('#008080') // darkened cyan
   })
})
