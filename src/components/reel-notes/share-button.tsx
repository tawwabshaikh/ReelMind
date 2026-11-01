'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Share2, Check, Loader2, Link as LinkIcon, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface Props {
  noteId: string | null
  videoName: string
  /** Render as a compact icon button (in note-card header) or a labeled button. */
  variant?: 'icon' | 'labeled'
  disabled?: boolean
}

export function ShareButton({ noteId, videoName, variant = 'icon', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = noteId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?share=${noteId}`
    : ''

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Share link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select the URL and copy manually.')
    }
  }

  const canShare = !!noteId

  const trigger =
    variant === 'icon' ? (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        disabled={disabled || !canShare}
        onClick={() => setOpen(true)}
        aria-label="Share note"
        title={canShare ? 'Share link' : 'Save the note before sharing'}
      >
        <Share2 className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled || !canShare}
        onClick={() => setOpen(true)}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
    )

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-emerald-600" />
              Share this note
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can view the notes, transcript, and infographic for
              “{videoName}”. No login required.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} className="font-mono text-xs" />
            <Button size="icon" onClick={handleCopy} className="shrink-0" aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <LinkIcon className="h-3 w-3" /> What viewers will see
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>Read-only notes in English, Urdu, or Hinglish</li>
              <li>Full transcript</li>
              <li>Generated infographic images</li>
              <li>Download buttons for .md, .txt, and PNG</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Re-export for loading-state consumers. */
export { Loader2 }
