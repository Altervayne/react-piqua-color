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
   return <ColorPicker value={color} onChange={setColor} />
}

const hueValue = () => screen.getByRole('slider', { name: 'Hue' }).getAttribute('aria-valuenow')

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
