import { render } from '@testing-library/react'
import { CountUp } from './CountUp'

describe('CountUp', () => {
  it('expone el valor final accesible', () => {
    const { container } = render(<CountUp value={179} />)
    expect(container.querySelector('span')).toHaveAttribute('aria-label', '179')
  })
})
