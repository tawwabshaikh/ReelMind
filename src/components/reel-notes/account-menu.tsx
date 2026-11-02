'use client'

import { LogOut, UserRound } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function AccountMenu() {
  const { data } = useSession()
  if (!data?.user) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={`Sign out${data.user.email ? ` (${data.user.email})` : ''}`}
      title={data.user.email || 'Sign out'}
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      {data.user.image ? <img src={data.user.image} alt="" className="h-6 w-6 rounded-full" /> : <UserRound className="h-4 w-4" />}
      <span className="sr-only"><LogOut /> Sign out</span>
    </Button>
  )
}
