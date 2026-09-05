'use client'

import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Theme } from '@/lib/types'

interface ThemeOption {
  id: Theme
  label: string
  urdu: string
  swatch: string[]
}

const OPTIONS: ThemeOption[] = [
  { id: 'emerald', label: 'Emerald', urdu: 'زمردی', swatch: ['#0f2e2a', '#10b981', '#f59e0b'] },
  { id: 'midnight', label: 'Midnight', urdu: 'نیلی رات', swatch: ['#0b1020', '#6366f1', '#22d3ee'] },
  { id: 'sunrise', label: 'Sunrise', urdu: 'طلوع آفتاب', swatch: ['#2a0f1f', '#f97316', '#fbbf24'] },
]

interface Props {
  value: Theme
  onChange: (v: Theme) => void
  disabled?: boolean
}

export function ThemeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Palette className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-foreground">Infographic theme</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                'group relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-3 transition-all',
                active
                  ? 'border-amber-500/60 bg-amber-50 shadow-sm dark:bg-amber-950/20'
                  : 'border-border bg-muted/30 hover:border-amber-400/50 hover:bg-muted/50',
                disabled && 'pointer-events-none opacity-50',
              )}
              aria-pressed={active}
              aria-label={`Theme: ${opt.label}`}
            >
              <div className="flex h-6 w-full overflow-hidden rounded-md ring-1 ring-black/5">
                {opt.swatch.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <span className="text-[11px] font-semibold leading-none">{opt.label}</span>
              <span className="font-urdu text-[13px] leading-none text-muted-foreground" dir="rtl">
                {opt.urdu}
              </span>
              {active && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
