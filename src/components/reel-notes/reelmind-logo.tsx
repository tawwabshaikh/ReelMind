import Image from 'next/image'

/** ReelMind's original brand mark, displayed from the public icon asset. */
export function ReelMindLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-[28%] bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/icon.png"
        alt="ReelMind logo"
        fill
        sizes={`${size}px`}
        priority={size >= 32}
        className="scale-[1.9] object-contain"
      />
    </span>
  )
}

/** Wordmark: "Reel" in foreground, "Mind" in emerald accent. */
export function ReelMindWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-foreground">Reel</span>
      <span className="text-accent-emerald">Mind</span>
    </span>
  )
}
