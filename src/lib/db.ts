import { PrismaClient as LocalPrismaClient } from '@prisma/client'
import { PrismaClient as VercelPrismaClient } from '@/generated/prisma-postgres'

const globalForPrisma = globalThis as unknown as {
  prisma: LocalPrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL
const usePostgres = process.env.VERCEL === '1' || databaseUrl?.startsWith('postgres://') || databaseUrl?.startsWith('postgresql://')

const createClient = (): LocalPrismaClient => {
  const log: ('warn' | 'error')[] = process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  const options = {
    // Query logging can expose transcripts and other user content in logs.
    log,
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  }
  return (usePostgres
    ? new VercelPrismaClient(options)
    : new LocalPrismaClient(options)) as unknown as LocalPrismaClient
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
