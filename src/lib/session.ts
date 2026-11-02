import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return session.user.id
  // Preserve the single-user local workflow; production never receives this identity.
  return process.env.NODE_ENV === 'production' ? null : 'local-development-user'
}

export function noteOwnerScope(userId: string) {
  if (process.env.NODE_ENV !== 'production' && userId === 'local-development-user') {
    // Existing personal SQLite notes predate accounts. Keep those visible only on local dev.
    return { OR: [{ userId }, { userId: null }] }
  }
  return { userId }
}
