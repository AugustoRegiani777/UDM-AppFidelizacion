import type { HTMLMotionProps } from 'motion/react'
import { Pressable } from '@/motion/Pressable'

type Variant = 'primary' | 'dark' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white',
  dark: 'bg-ink text-bg',
  ghost: 'bg-transparent text-ink ring-2 ring-inset ring-track',
  danger: 'bg-transparent text-brand-ink ring-2 ring-inset ring-brand',
}

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <Pressable
      className={`min-h-12 w-full rounded-chip px-6 text-base font-bold disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
