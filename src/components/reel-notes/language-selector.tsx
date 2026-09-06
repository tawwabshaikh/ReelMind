'use client'

import { cn } from '@/lib/utils'
import type { Language } from '@/lib/types'

interface Props {
  value: Language
  onChange: (v: Language) => void
  disabled?: boolean
}

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'urdu', label: 'اردو' },
  { value: 'both', label: 'Both' },
]

export function LanguageSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Output language</label>
      <div
        className={cn(
          'inline-flex w-full rounded-lg border border-border bg-muted/40 p-0.5',
          disabled && 'pointer-events-none opacity-50',
        )}
        role="radiogroup"
        aria-label="Output language"
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value
          const isUrdu = opt.value === 'urdu'
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={isUrdu ? 'font-urdu text-base leading-none' : ''} dir={isUrdu ? 'rtl' : 'ltr'}>
                {opt.label}
              </span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
