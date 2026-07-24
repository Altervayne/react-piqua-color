// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
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

describe('ColorPicker — swatch placement', () => {
   // Placement must move in the DOM (not via CSS order), so reading/focus order
   // follows the visual order. Assert document position, not styling.
   const swatchesBeforeBody = () => {
      const group = screen.getByRole('group', { name: 'Default colors' })
      const body = screen.getByRole('slider', { name: 'Saturation and brightness' })
      return Boolean(group.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)
   }

   it('renders swatches below the body by default', () => {
      render(<ColorPicker value="#f97316" onChange={() => {}} swatches={['#000000']} />)
      expect(swatchesBeforeBody()).toBe(false)
   })

   it('renders swatches above the body when swatchesPosition="top"', () => {
      render(<ColorPicker value="#f97316" onChange={() => {}} swatches={['#000000']} swatchesPosition="top" />)
      expect(swatchesBeforeBody()).toBe(true)
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

describe('ColorPicker — alpha', () => {
   function ControlledAlpha({ initial = '#3b82f6' }: { initial?: string }) {
      const [color, setColor] = useState(initial)
      return (
         <>
            <ColorPicker value={color} onChange={setColor} alpha />
            <output data-testid="color">{color}</output>
         </>
      )
   }

   it('shows no opacity slider by default', () => {
      render(<Controlled />)
      expect(screen.queryByRole('slider', { name: 'Opacity' })).toBeNull()
      expect(screen.getByPlaceholderText('rrggbb')).toBeTruthy()
   })

   it('adds an opacity slider and widens the hex field when alpha is on', () => {
      render(<ControlledAlpha />)
      expect(screen.getByRole('slider', { name: 'Opacity' })).toBeTruthy()
      const hex = screen.getByPlaceholderText('rrggbbaa') as HTMLInputElement
      expect(hex.maxLength).toBe(8)
   })

   it('emits eight-digit hex from a typed eight-digit value', () => {
      render(<ControlledAlpha />)
      fireEvent.change(screen.getByPlaceholderText('rrggbbaa'), { target: { value: '11223380' } })
      expect(currentColor()).toBe('#11223380')
   })

   it('reads a six-digit entry as fully opaque when alpha is on', () => {
      render(<ControlledAlpha />)
      fireEvent.change(screen.getByPlaceholderText('rrggbbaa'), { target: { value: 'ff0000' } })
      expect(currentColor()).toBe('#ff0000ff')
   })

   it('drives opacity from the alpha slider — percent presented, byte emitted', () => {
      render(<ControlledAlpha initial="#ff0000ff" />)
      const opacity = screen.getByRole('slider', { name: 'Opacity' })
      expect(opacity.getAttribute('aria-valuenow')).toBe('100')
      fireEvent.keyDown(opacity, { key: 'Home' })      // → 0%
      expect(opacity.getAttribute('aria-valuenow')).toBe('0')
      expect(currentColor()).toBe('#ff000000')          // fully transparent red
   })

   it('expands 3-digit shorthand on blur (no alpha)', () => {
      render(<Controlled />)
      const hex = screen.getByPlaceholderText('rrggbb')
      fireEvent.change(hex, { target: { value: 'f80' } })
      fireEvent.blur(hex)
      expect(currentColor()).toBe('#ff8800')
   })

   it('expands 3-digit shorthand on blur (alpha on)', () => {
      render(<ControlledAlpha />)
      const hex = screen.getByPlaceholderText('rrggbbaa')
      fireEvent.change(hex, { target: { value: 'f80' } })
      fireEvent.blur(hex)
      expect(currentColor()).toBe('#ff8800ff')
   })
})

describe('ColorPicker — copy & eyedropper', () => {
   function Host({ initial = '#000000' }: { initial?: string }) {
      const [color, setColor] = useState(initial)
      return (
         <>
            <ColorPicker value={color} onChange={setColor} />
            <output data-testid="color">{color}</output>
         </>
      )
   }

   it('copies the current hex to the clipboard and shows feedback', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      render(<ColorPicker value="#3b82f6" onChange={() => {}} />)
      fireEvent.click(screen.getByLabelText('Copy hex'))
      expect(writeText).toHaveBeenCalledWith('#3b82f6')
      expect(await screen.findByLabelText('Copied')).toBeTruthy()
   })

   it('applies a color picked via the EyeDropper API', async () => {
      class FakeEyeDropper { open() { return Promise.resolve({ sRGBHex: '#00ff00' }) } }
      window.EyeDropper = FakeEyeDropper
      render(<Host />)
      fireEvent.click(await screen.findByLabelText('Pick a color from the screen'))
      await waitFor(() => expect(screen.getByTestId('color').textContent).toBe('#00ff00'))
      delete window.EyeDropper
   })

   it('hides the eyedropper button when the API is unavailable', () => {
      delete window.EyeDropper
      render(<Host />)
      expect(screen.queryByLabelText('Pick a color from the screen')).toBeNull()
   })
})
