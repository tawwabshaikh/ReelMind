'use client'

import { signIn, useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReelMindLogo } from '@/components/reel-notes/reelmind-logo'

export default function LoginPage() {
  const { status } = useSession()
  const callbackUrl = typeof window === 'undefined' ? '/' : new URLSearchParams(window.location.search).get('callbackUrl') || '/'

  useEffect(() => {
    if (status === 'authenticated') window.location.assign(callbackUrl)
  }, [status, callbackUrl])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center"><ReelMindLogo /></div>
        <h1 className="text-2xl font-semibold">Sign in to ReelMind</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your video notes and transcripts stay private to your account.</p>
        {status === 'loading' ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" aria-label="Loading session" />
        ) : (
          <Button className="mt-8 w-full" disabled={!process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED} onClick={() => signIn('google', { callbackUrl })}>
            Continue with Google
          </Button>
        )}
        {!process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED && <p className="mt-4 text-xs text-muted-foreground">Google sign-in is not configured for this deployment yet.</p>}
      </section>
    </main>
  )
}
