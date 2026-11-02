import { spawnSync } from 'node:child_process'
import path from 'node:path'

const prismaBin = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma')
const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:../db/custom.db' }

for (const schema of ['prisma/schema.prisma', 'prisma/schema.vercel.prisma']) {
  const result = spawnSync(prismaBin, ['generate', '--schema', schema], { env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
