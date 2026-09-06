/**
 * ReelMind logo — an abstract mark suggesting layered knowledge.
 * A rounded square (primary green) with three horizontal lines of decreasing
 * width (emerald → white fading), evoking text/knowledge layers without
 * using any literal play-button, robot, or brain imagery.
 * Recognisable at 16px.
 */
export function ReelMindLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7" fill="var(--rm-primary, #0B3D2E)" />
      <rect x="7" y="9" width="14" height="2.5" rx="1.25" fill="var(--rm-accent, #10B981)" />
      <rect x="7" y="14" width="14" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.7" />
      <rect x="7" y="19" width="9" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.4" />
    </svg>
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
