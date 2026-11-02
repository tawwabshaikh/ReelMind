import { promises as fs } from 'node:fs'
import path from 'node:path'
import { del, get, put } from '@vercel/blob'

const LOCAL_ARTIFACT_DIR = path.join(process.cwd(), 'var', 'generated')

function isVercelRuntime() {
  return process.env.VERCEL === '1'
}

function assertStorageKey(key: string) {
  if (!/^(?:[A-Za-z0-9_-]+\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) {
    throw new Error('Invalid generated artifact key.')
  }
}

export function makeArtifactKey(userId: string, filename: string) {
  const key = `${userId}/${filename}`
  assertStorageKey(key)
  return key
}

export async function storeArtifact(key: string, bytes: Uint8Array, contentType: string) {
  assertStorageKey(key)
  if (isVercelRuntime()) {
    if (!key.includes('/')) return null
    await put(key, Buffer.from(bytes), { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: false })
    return
  }
  const filePath = path.join(LOCAL_ARTIFACT_DIR, key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, bytes)
}

export async function readArtifact(key: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
  assertStorageKey(key)
  if (isVercelRuntime()) {
    const result = await get(key, { access: 'private' })
    if (!result || result.statusCode !== 200) return null
    return { stream: result.stream, contentType: result.blob.contentType }
  }
  try {
    const filePath = key.includes('/')
      ? path.join(LOCAL_ARTIFACT_DIR, key)
      : path.join(process.cwd(), 'public', 'generated', key)
    const bytes = await fs.readFile(filePath)
    return {
      stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close() } }),
      contentType: key.endsWith('.pdf') ? 'application/pdf' : 'image/png',
    }
  } catch {
    return null
  }
}

export async function readArtifactBytes(key: string): Promise<Uint8Array | null> {
  const result = await readArtifact(key)
  if (!result) return null
  return new Uint8Array(await new Response(result.stream).arrayBuffer())
}

export async function deleteArtifact(key: string) {
  assertStorageKey(key)
  if (isVercelRuntime()) {
    if (!key.includes('/')) return
    await del(key)
    return
  }
  const filePath = key.includes('/')
    ? path.join(LOCAL_ARTIFACT_DIR, key)
    : path.join(process.cwd(), 'public', 'generated', key)
  await fs.unlink(filePath).catch(() => {})
}
