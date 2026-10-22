import type { InputHTMLAttributes, ReactNode } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode
}

export function Checkbox({ children, ...props }: CheckboxProps) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 text-left">
      <input type="checkbox" className="accent-brand mt-1 size-6 shrink-0" {...props} />
      <span className="text-muted text-sm leading-snug">{children}</span>
    </label>
  )
}
