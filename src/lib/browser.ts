import { chromium as playwrightChromium, type Browser } from 'playwright'

/** Uses a Vercel-compatible packaged Chromium in production and local Playwright during development. */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL === '1') {
    const serverlessChromium = (await import('@sparticuz/chromium')).default
    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    })
  }
  return playwrightChromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
}
