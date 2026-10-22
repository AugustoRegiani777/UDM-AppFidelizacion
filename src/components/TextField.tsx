import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, id, ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-left" htmlFor={id}>
      <span className="text-muted text-sm font-semibold">{label}</span>
      <input
        id={id}
        className="bg-surface ring-track focus:ring-brand min-h-12 rounded-chip px-4 text-base ring-2 outline-none"
        {...props}
      />
    </label>
  )
}
