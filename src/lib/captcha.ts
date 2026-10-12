// Bot protection (Sprint 87): Cloudflare Turnstile, run only when a form is
// sent — sign-up, sign-in, password reset, resending the confirmation and
// newsletter sign-up. It stays invisible unless Cloudflare wants the visitor
// to click a box, which then shows in the bottom-right corner.
//
// Off until VITE_TURNSTILE_SITE_KEY is set in Vercel (then redeploy): with
// no key every call returns undefined and the forms work as before. The
// same key is used by the BGrowth Website; the secret key lives in Supabase
// (Authentication → Attack Protection). Copied from the Website
// (src/lib/captcha.ts there) — keep both the same.

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

let loading: Promise<TurnstileApi> | undefined

function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile
  if (existing) return Promise.resolve(existing)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
      if (api) resolve(api)
      else reject(new Error('Security check didn’t load.'))
    }
    script.onerror = () => {
      loading = undefined
      reject(new Error('Security check didn’t load. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** A one-time Turnstile token for this submission (undefined while the protection is off). */
export async function getCaptchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === 'undefined') return undefined
  const turnstile = await loadTurnstile()
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999'
  document.body.appendChild(box)
  let widgetId: string | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('The security check took too long. Please try again.')), 60000)
      widgetId = turnstile.render(box, {
        sitekey: SITE_KEY,
        action,
        appearance: 'interaction-only',
        callback: (token: string) => {
          window.clearTimeout(timer)
          resolve(token)
        },
        'error-callback': () => {
          window.clearTimeout(timer)
          reject(new Error('The security check failed. Please try again.'))
        },
      })
    })
  } finally {
    if (widgetId) turnstile.remove(widgetId)
    box.remove()
  }
}
