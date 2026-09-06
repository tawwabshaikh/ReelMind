/**
 * Safe JSON fetch helper — prevents "Unexpected token '<'" crashes when the
 * server is down or returns an HTML error page instead of JSON.
 *
 * Usage:
 *   const { data, error } = await safeJsonFetch('/api/notes')
 *   if (error) { toast.error(error); return }
 */

export async function safeJsonFetch<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<{ data: T | null; error: string | null; res: Response | null }> {
  try {
    const res = await fetch(input, init)

    // Check if the response is JSON before attempting to parse
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      // Server is likely down — the gateway returned HTML
      if (res.status === 0 || res.status >= 500) {
        return { data: null, error: 'The server is starting up or temporarily unavailable. Please try again in a moment.', res }
      }
      return { data: null, error: `Unexpected response (HTTP ${res.status}). The server may be restarting.`, res }
    }

    const data = (await res.json()) as T
    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error || `Request failed (${res.status})`
      return { data: null, error: errMsg, res }
    }

    return { data, error: null, res }
  } catch (e) {
    // Network error (server completely down, connection refused)
    if (e instanceof TypeError && e.message.includes('fetch')) {
      return { data: null, error: 'Cannot connect to the server. It may be restarting — please try again in a moment.', res: null }
    }
    return { data: null, error: e instanceof Error ? e.message : 'Network error', res: null }
  }
}
