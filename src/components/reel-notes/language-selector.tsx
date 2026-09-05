'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Languages, Type, Columns2 } from 'lucide-react'
import type { Language } from '@/lib/types'

interface Props {
  value: Language
  onChange: (v: Language) => void
  disabled?: boolean
}

const OPTIONS: { value: Language; label: string; urdu: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'english', label: 'English', urdu: 'انگریزی', icon: <Type className="h-4 w-4" />, desc: 'Notes in English only' },
  { value: 'urdu', label: 'Urdu', urdu: 'اردو', icon: <Languages className="h-4 w-4" />, desc: 'Proper Nastaliq script' },
  { value: 'both', label: 'Both', urdu: 'دونوں', icon: <Columns2 className="h-4 w-4" />, desc: 'EN + UR, two versions' },
]

export function LanguageSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">Output language</label>
        <span className="text-xs text-muted-foreground">Urdu renders in Nastaliq script</span>
      </div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as Language)
        }}
        disabled={disabled}
        className="grid w-full grid-cols-3 gap-2 rounded-xl bg-muted/50 p-1.5"
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              aria-label={opt.label}
              className="flex h-auto flex-col items-center gap-1 rounded-lg border border-transparent py-3 data-[state=on]:border-emerald-500/40 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                {opt.icon}
              </span>
              <span className="text-sm font-semibold leading-none">{opt.label}</span>
              <span className="font-urdu text-base text-muted-foreground leading-none" dir="rtl">{opt.urdu}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {OPTIONS.find((o) => o.value === value)?.desc}
      </p>
    </div>
  )
}
