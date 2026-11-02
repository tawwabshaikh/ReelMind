export class ProcessingWorkerError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message)
    this.name = 'ProcessingWorkerError'
  }
}

export async function callProcessingWorker<T>(endpoint: string, payload: unknown): Promise<T> {
  const baseUrl = process.env.PROCESSING_WORKER_URL?.trim().replace(/\/+$/, '')
  const token = process.env.PROCESSING_WORKER_TOKEN
  if (!baseUrl || !token) {
    throw new ProcessingWorkerError('Video and AI processing are not configured for this deployment. Add the secured processing worker URL and token.')
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/${endpoint.replace(/^\/+/, '')}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300_000),
      cache: 'no-store',
    })
  } catch {
    throw new ProcessingWorkerError('The processing worker could not be reached. Please retry shortly.', 502)
  }

  const result = await response.json().catch(() => ({})) as { error?: unknown }
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error.slice(0, 500) : 'The processing worker failed.'
    throw new ProcessingWorkerError(message, response.status >= 400 && response.status < 600 ? response.status : 502)
  }
  return result as T
}
